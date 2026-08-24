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

import { createHash } from 'node:crypto';
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
const expectedCases = {
  '01-fs-chain': { digest: '9d06cd88cfdce11a33d853ca5410088d9ab0a1a82aa384237147cd9a08ac70fb', activities: ['A', 'B', 'C'] },
  '02-ss-with-lag': { digest: '7719cb13f2bfd5297dc5302f9f2ab672376d7b6e7cafcbfa5c52cbbf64c45cae', activities: ['A', 'B'] },
  '03-ff-with-lag': { digest: 'bb8f76a2bdb926bdd0e7177f28c94da117cd8c55b110882f84ae958ed028d2da', activities: ['A', 'B'] },
  '04-sf-edge-case': { digest: 'be04f8ccd8430726635b87654b2039d64fb70779f12562f260bdf3e72d3eb654', activities: ['A', 'B'] },
  '05-negative-float': { digest: '463f4ea2ee5e973340d82b26e2adbf0305b0815161f8b78dc074f381140d22b1', activities: ['A', 'B'] },
  '06-multiple-calendars': { digest: '8623f28be05dfcbee390746c5ece5aacfb5c1501edbee3e74ffee92ac1730432', activities: ['A', 'B'] },
  '07-ontario-holidays': { digest: '23ec9703eab963f8f1300ecdc7bfadd902668314d3008e172048a7adb5042026', activities: ['A'] },
  '08-in-progress-retained-logic': { digest: '67c9811d83cdeace67fe7b410aa59b8550ae30cee287d6ee2bda7cd4347e255d', activities: ['A', 'B'] },
  '09-completed-successor': { digest: '0307a19fb51a61f1ad7b6445cbd6f2a20618ee4408912bc2cd320aca6ed1416b', activities: ['A', 'B'] },
  '10-out-of-sequence-progress': { digest: '2f598578d4539a95ea80698ab2979fd28a3cb007d8fe09e679a1173f00f5c5f6', activities: ['A', 'B'] },
  '11-mandatory-start-finish': { digest: 'b4353c7fcdfff89ae1740cfa1e85a5c72d7c9493a53eea37a5cab246b828453b', activities: ['A', 'B'] },
  '12-snet-fnlt': { digest: '42480cf535150559b1ed5ed11d5e7604ee3c6ae1d666b9a555ab84b4936f0ee6', activities: ['A', 'B'] },
  '13-alap': { digest: '6ed931a167215ec05a8410c0751a02e429026b62410f0fed4f8768746f6a37bc', activities: ['A', 'B', 'C'] },
};
const expectedCaseIds = Object.keys(expectedCases);
const caseDirs = readdirSync(join(sourceRoot, 'cases'), { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort();
if (JSON.stringify(caseDirs) !== JSON.stringify(expectedCaseIds)) {
  throw new Error(`onverwachte caseset: verwacht ${expectedCaseIds.join(', ')}, kreeg ${caseDirs.join(', ')}`);
}

const cases = caseDirs.map(id => {
  const csvPath = join(sourceRoot, 'cases', id, 'comparison.csv');
  if (!existsSync(csvPath)) throw new Error(`${id}: comparison.csv ontbreekt`);
  const sourceBytes = readFileSync(csvPath);
  const digest = createHash('sha256').update(sourceBytes).digest('hex');
  if (digest !== expectedCases[id].digest) {
    throw new Error(`${id}: bron-SHA-256 verwacht ${expectedCases[id].digest}, kreeg ${digest}`);
  }
  const [header, ...rows] = parseCsv(sourceBytes.toString('utf-8'));
  const indexes = selectedColumns.map(column => {
    const matches = header.map((value, index) => value === column ? index : -1).filter(index => index >= 0);
    if (matches.length !== 1) throw new Error(`${id}: kolom ${column} moet exact eenmaal voorkomen`);
    return matches[0];
  });
  const activities = rows
    .filter(row => row.some(cellValue => cellValue !== ''))
    .map((row, rowIndex) => {
      const activity = Object.fromEntries(selectedColumns.map((column, index) => [column, row[indexes[index]] ?? '']));
      for (const field of ['ES_p6', 'EF_p6', 'LS_p6', 'LF_p6']) {
        if (activity[field] !== '' && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?: A)?$/.test(activity[field])) {
          throw new Error(`${id}/rij ${rowIndex + 2}/${field}: ongeldige P6-datum ${JSON.stringify(activity[field])}`);
        }
      }
      for (const field of ['TF_p6', 'FF_p6']) {
        if (activity[field] !== '' && !/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(activity[field])) {
          throw new Error(`${id}/rij ${rowIndex + 2}/${field}: ongeldige P6-float ${JSON.stringify(activity[field])}`);
        }
      }
      return activity;
    });
  const activityCodes = activities.map(activity => activity.activity_code);
  if (new Set(activityCodes).size !== activityCodes.length) throw new Error(`${id}: dubbele activity_code`);
  if (JSON.stringify(activityCodes) !== JSON.stringify(expectedCases[id].activities)) {
    throw new Error(`${id}: activiteitset verwacht ${expectedCases[id].activities.join(', ')}, kreeg ${activityCodes.join(', ')}`);
  }
  return { id, sourceSha256: digest, activities };
});

const output = {
  provenance: {
    repository: 'https://github.com/danafitkowski/cpp-cpm-engine.git',
    sourceCommit: 'c279a5c4ff204ba763a6f9726aa6383574b50475',
    capture: 'Menselijke P6 23.12-capture van 2026-08-11; het primaire capturesheet is niet meegecommit.',
    scope: 'Uitsluitend activity_code en de onvertaalde *_p6-kolommen zijn overgenomen; kloktijden en actual-suffixen blijven staan.',
    warning: 'De *_engine-kolommen en PASS-oordelen zijn geen meetlat: daarbij is tijd weggegooid, het exclusief/inclusief-finishverschil genormaliseerd en de bronengine na deze capture nagefit.',
  },
  cases,
};

writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf-8');
console.log(`P6-vergelijkingsdata geschreven: ${cases.length} cases naar ${outputPath}`);
