#!/usr/bin/env node
/**
 * Echte spreadsheetgrens voor het taakgridklembordcontract.
 *
 * Bouwt de TSV met de productie-serializer, laat LibreOffice Calc die tekst naar XLSX en terug naar
 * tabgescheiden tekst converteren, en valideert daarna met de productieparser dat alle cellen —
 * inclusief de volledige OPS-EXT/1-suffix — exact terugkomen.
 */
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

const soffice = process.argv[2];
if (!soffice) {
  console.error('Gebruik: node scripts/verify-task-grid-spreadsheet.mjs <absoluut-soffice-pad>');
  process.exit(64);
}

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const work = await mkdtemp(join(tmpdir(), 'ops-grid-spreadsheet-'));
const bridgePath = join(work, 'task-grid-spreadsheet-bridge.mjs');
const built = await build({
  stdin: {
    contents: [
      "export { serializeTaskGridTsv, parseTaskGridTsv } from '@/engine/taskGrid/clipboard';",
      "export { formatExternalRelationClipboard, parseExternalRelationClipboard } from '@/engine/taskGrid/relationFormat';",
    ].join('\n'),
    resolveDir: root,
    sourcefile: 'task-grid-spreadsheet-bridge.ts',
  },
  absWorkingDir: root,
  alias: { '@': join(root, 'src') },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'silent',
});
await writeFile(bridgePath, built.outputFiles[0].text, 'utf8');
const api = await import(`${pathToFileURL(bridgePath).href}?v=${Date.now()}`);

const externalLink = {
  id: 'ext-calc-1',
  direction: 'predecessor',
  relType: 'FS',
  lagDays: 2,
  anchorDate: '2026-09-02',
  sourceMissing: false,
  sourceRef: {
    projectId: 'bron-calc-1',
    projectName: 'Project, "West" / A\\B',
    taskId: 'taak-calc-9',
    taskName: 'Fundering / "Noord", X',
    filePath: 'C:\\Projecten\\West.ifc',
  },
};
const externalToken = api.formatExternalRelationClipboard('owner-calc-1', externalLink);
const matrix = [
  [
    'Tekst met "quotes"',
    '01-09-2026',
    '01-09-2026 07:30',
    '2d',
    '37.5%',
    '1FS+2d',
    externalToken,
  ],
  [
    'Regel 1\nRegel 2',
    '02-09-2026',
    '02-09-2026 16:15',
    '90m',
    '100%',
    '2SS-1d',
    externalToken.replace('FS+2d ⟦', 'FF+2d ⟦'),
  ],
];
const inputTsv = api.serializeTaskGridTsv(matrix);
const inputPath = join(work, 'task-grid.tsv');
await writeFile(inputPath, inputTsv, 'utf8');

const profile = join(work, 'profile');
const xlsxDir = join(work, 'xlsx');
const returnedDir = join(work, 'returned');
const mkdir = spawnSync('mkdir', ['-p', profile, xlsxDir, returnedDir], { encoding: 'utf8' });
if (mkdir.status !== 0) throw new Error(`tijdelijke mappen maken faalde: ${mkdir.stderr}`);

// 9=tab, 34=quote, 76=UTF-8, rij 1; de laatste `false` schakelt speciale-getaldetectie uit.
// Dat is de spreadsheetinstelling "aangehaalde/ingevoerde waarden als tekst behouden" en voorkomt
// dat Calc een persoonlijke taakgriddatum stil naar een locale spreadsheetdatum herschrijft.
const importFilter = 'Text - txt - csv (StarCalc):9,34,76,1,,0,false,true,true,false';
const toXlsx = spawnSync(soffice, [
  '--headless', `-env:UserInstallation=${pathToFileURL(profile).href}`,
  `--infilter=${importFilter}`, '--convert-to', 'xlsx:Calc MS Excel 2007 XML',
  '--outdir', xlsxDir, inputPath,
], { encoding: 'utf8' });
if (toXlsx.status !== 0) {
  throw new Error(`LibreOffice TSV→XLSX faalde (${toXlsx.status}): ${toXlsx.stderr || toXlsx.stdout}`);
}
const xlsxPath = join(xlsxDir, 'task-grid.xlsx');

const exportFilter = 'Text - txt - csv (StarCalc):9,34,76,1,,0,false,true,true,false';
const fromXlsx = spawnSync(soffice, [
  '--headless', `-env:UserInstallation=${pathToFileURL(profile).href}`,
  '--convert-to', `csv:${exportFilter}`, '--outdir', returnedDir, xlsxPath,
], { encoding: 'utf8' });
if (fromXlsx.status !== 0) {
  throw new Error(`LibreOffice XLSX→TSV faalde (${fromXlsx.status}): ${fromXlsx.stderr || fromXlsx.stdout}`);
}
const returnedPath = join(returnedDir, 'task-grid.csv');
const returnedText = (await readFile(returnedPath, 'utf8')).replace(/\n$/, '');
const parsed = api.parseTaskGridTsv(returnedText);
if (!parsed.ok) throw new Error(`Productie-TSV-parser wees Calc-uitvoer af: ${JSON.stringify(parsed.errors)}`);
const normalizedPercentage = value => Number.parseFloat(value.replace('%', '')) / 100;
const formattingChanges = [];
for (let rowIndex = 0; rowIndex < matrix.length; rowIndex++) {
  for (let columnIndex = 0; columnIndex < matrix[rowIndex].length; columnIndex++) {
    const before = matrix[rowIndex][columnIndex];
    const after = parsed.value[rowIndex]?.[columnIndex];
    if (columnIndex === 4) {
      if (normalizedPercentage(before) !== normalizedPercentage(after)) {
        throw new Error(`Calc veranderde percentage op ${rowIndex + 1},${columnIndex + 1}: ${before} → ${after}`);
      }
      if (before !== after) formattingChanges.push({ row: rowIndex + 1, column: columnIndex + 1, before, after });
    } else if (before !== after) {
      throw new Error(`Calc veranderde cel ${rowIndex + 1},${columnIndex + 1}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
    }
  }
}

for (const [rowIndex, row] of parsed.value.entries()) {
  const relation = api.parseExternalRelationClipboard(row[6], {
    ownerTaskId: 'owner-calc-1', direction: 'predecessor',
  });
  if (!relation.ok) throw new Error(`Externe relatietoken op rij ${rowIndex + 1} verloor zijn payload.`);
}

console.log(JSON.stringify({
  ok: true,
  office: (toXlsx.stdout + toXlsx.stderr).trim().split('\n').filter(Boolean).at(-1) ?? 'LibreOffice Calc',
  rows: matrix.length,
  columns: matrix[0].length,
  tsvBytes: Buffer.byteLength(inputTsv),
  returnedBytes: Buffer.byteLength(returnedText),
  externalPayloads: matrix.length,
  formattingChanges,
  work,
}, null, 2));
