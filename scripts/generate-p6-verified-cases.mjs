#!/usr/bin/env node

/**
 * Extraheert uitsluitend de door P6 23.12 vastgelegde kolommen uit het publieke
 * cpp-cpm-engine-vergelijkingsraamwerk. De enginekolommen en verdicts worden niet ingelezen in het
 * resultaat: hun vergelijking gooide kloktijden weg, normaliseerde exclusieve/inclusieve finishes
 * en de bronengine is na de capture op deze cases nagefit. Ze zijn daarom geen onafhankelijke
 * meetlat voor Open Planner Studio.
 *
 * Gebruik:
 *   node scripts/generate-p6-verified-cases.mjs <p6-comparison-map> [uitvoer-json]
 *
 * De bronmap mag ook via OPS_P6_COMPARISON worden gezet. Er staat bewust geen lokaal corpuspad in
 * dit script.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = process.argv[2] ?? process.env.OPS_P6_COMPARISON;
const outputPath = process.argv[3]
  ?? fileURLToPath(new URL('../tests/planning/cases-p6-verified.json', import.meta.url));

if (!sourceRoot || !existsSync(join(sourceRoot, 'cases'))) {
  console.error('Geef een bestaande p6-comparison-map via argument 1 of OPS_P6_COMPARISON.');
  process.exit(1);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell.endsWith('\r') ? cell.slice(0, -1) : cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const selectedColumns = ['activity_code', 'ES_p6', 'EF_p6', 'LS_p6', 'LF_p6', 'TF_p6', 'FF_p6'];
const caseDirs = readdirSync(join(sourceRoot, 'cases'), { withFileTypes: true })
  .filter(entry => entry.isDirectory() && /^\d{2}-/.test(entry.name))
  .map(entry => entry.name)
  .sort();

const cases = caseDirs.map(id => {
  const csvPath = join(sourceRoot, 'cases', id, 'comparison.csv');
  if (!existsSync(csvPath)) throw new Error(`${id}: comparison.csv ontbreekt`);
  const [header, ...rows] = parseCsv(readFileSync(csvPath, 'utf-8'));
  const indexes = selectedColumns.map(column => {
    const index = header.indexOf(column);
    if (index < 0) throw new Error(`${id}: kolom ${column} ontbreekt`);
    return index;
  });
  const activities = rows
    .filter(row => row.some(cellValue => cellValue !== ''))
    .map(row => Object.fromEntries(selectedColumns.map((column, index) => [column, row[indexes[index]] ?? ''])));
  return { id, activities };
});

const output = {
  provenance: {
    source: 'cpp-cpm-engine validation/p6-comparison; menselijke P6 23.12-capture van 2026-08-11',
    scope: 'Uitsluitend activity_code en de onvertaalde *_p6-kolommen zijn overgenomen; kloktijden en actual-suffixen blijven staan.',
    warning: 'De *_engine-kolommen en PASS-oordelen zijn geen meetlat: daarbij is tijd weggegooid, het exclusief/inclusief-finishverschil genormaliseerd en de bronengine na deze capture nagefit.',
  },
  cases,
};

writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf-8');
console.log(`P6-vergelijkingsdata geschreven: ${cases.length} cases naar ${outputPath}`);
