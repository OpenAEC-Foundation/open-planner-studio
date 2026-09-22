#!/usr/bin/env node
// `npm run measure:profiles` — de landingsmeting van regel A (rekenprofielen-spec §2 besluit 5, §5).
//
// Draait achter elkaar, elk als eigen `bash tests/planning/run.sh <check>`-aanroep (dus met eigen
// exitcode), en print daarna één samenvattingstabel per profiel:
//   P6-profiel          check-xer-product-fidelity-x12.ts mét OPS_XER_CORPUS: de cel-poort
//                       (xer-product-fidelity-cells.json) plus de drie nuldoelregels;
//   MS Project-profiel  check-mpp-fidelity.ts: GOAL_ZERO_DEVIATIONS en de per-bestand-tellingenpins.
//                       Het MS Project-orakel meet alleen start en einde (twee assen); omdat die
//                       baseline op nul staat is elke pin al een cel-poort, er is geen cel-bestand;
//   vangrails           check-xer-corpusless-fidelity-gate.ts + check-fidelity-cells-gate.ts
//                       (corpusloos, bewaken de gecommitte baselines);
//   --full              daarna de volledige corpusloze planningssuite (zonder OPS_XER_CORPUS).
//                       Standaard NIET: die draait al in `npm run verify`, en machinebreed hoort er
//                       maar één zware run tegelijk te lopen.
//
// Oordeel op exitcodes. Eén uitzondering, hier expliciet: X12 staat by design rood op precies de drie
// nuldoelregels (plan XER §1, nuldoel niet gehaald). Is dat de ENIGE rode uitvoer en is de cel-poort
// groen, dan telt het P6-profiel als "regel A gehouden" (status NULDOEL). Elke andere rode regel is
// rood. `--strict` laat ook die bekende nuldoeltoestand exit 1 geven.
//
// Exit 0 = regel A gehouden onder elk gemeten profiel, 1 = minstens één onderdeel rood.
// Niet in `verify`: corpusgebonden, en het corpus zit niet in de repo.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RUN = join(ROOT, 'tests', 'planning', 'run.sh');
const args = new Set(process.argv.slice(2));
const unknown = [...args].filter((arg) => arg !== '--full' && arg !== '--strict');
if (unknown.length > 0) {
  console.error(`onbekend argument: ${unknown.join(' ')} (verwacht --full en/of --strict)`);
  process.exit(2);
}
const FULL = args.has('--full');
const STRICT = args.has('--strict');

const KNOWN_GOAL_LINES = [
  'XX X12 nuldoel is baseline-onafhankelijk: ieder bestand haalt de zesassige poort: ',
  'XX X12 nuldoel is baseline-onafhankelijk: alle zes assen zijn nul: ',
  'XX X12 nuldoel is baseline-onafhankelijk: totaal zesassige afwijkingen is nul: ',
];

const logDir = mkdtempSync(join(tmpdir(), 'ops-measure-profiles-'));

function run(name, checks, env) {
  const started = Date.now();
  const result = spawnSync('bash', [RUN, ...checks], {
    cwd: ROOT, env, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const log = join(logDir, `${name}.log`);
  writeFileSync(log, output);
  const exit = result.status ?? 1;
  const seconds = Math.round((Date.now() - started) / 1000);
  console.log(`   . ${name}: exit ${exit} in ${seconds}s — log ${log}`);
  return { exit, output, log, lines: output.split('\n') };
}

/** Alle faalregels: XX (ook ingesprongen, zie CLAUDE.md) plus stacktraces/esbuild-fouten. */
function failureLines(lines) {
  return lines.filter((line) => /^\s*XX\s/.test(line) || /^\s*XX$/.test(line)
    || /^\s+at \S.*:\d+:\d+\)?$/.test(line) || /^✘ \[ERROR\]/.test(line));
}

const rows = [];
let red = false;

// ── P6-profiel ────────────────────────────────────────────────────────────────────────────────
const corpus = process.env.OPS_XER_CORPUS;
if (!corpus || !existsSync(corpus)) {
  console.error('OPS_XER_CORPUS ontbreekt of bestaat niet — zonder corpus meet het P6-profiel niets');
  rows.push({ profile: 'P6', part: 'X12 productfidelity', exit: '-', status: 'ROOD (geen corpus)', counts: '-', cells: '-' });
  red = true;
} else {
  const x12 = run('p6-x12', ['check-xer-product-fidelity-x12.ts'], { ...process.env, OPS_XER_CORPUS: corpus });
  const delta = x12.lines.find((line) => line.startsWith('CELLDELTA p6 ')) ?? '';
  const cellOk = x12.lines.some((line) => line.startsWith('OK  X12 cel-baseline (regel A):'));
  const perAxis = (x12.lines.find((line) => line.startsWith('OK  X12 cel-baseline (regel A):')) ?? '')
    .replace(/^.*inexact per as /, '').replace(/;.*$/, '');
  const goal = x12.lines.find((line) => line.startsWith(KNOWN_GOAL_LINES[2]));
  const sixAxis = goal ? goal.replace(/^.*kreeg /, '') : (x12.exit === 0 ? '0' : '?');
  const failures = failureLines(x12.lines);
  const onlyKnownGoal = failures.length === KNOWN_GOAL_LINES.length
    && KNOWN_GOAL_LINES.every((prefix) => failures.some((line) => line.startsWith(prefix)));
  let status;
  if (x12.exit === 0 && cellOk) status = 'GROEN';
  else if (x12.exit !== 0 && onlyKnownGoal && cellOk) status = STRICT ? 'ROOD (nuldoel, --strict)' : 'NULDOEL (regel A gehouden)';
  else status = `ROOD (${failures.length} faalregel(s))`;
  if (status.startsWith('ROOD')) red = true;
  rows.push({
    profile: 'P6', part: 'X12 productfidelity (cel-poort + nuldoel)', exit: String(x12.exit), status,
    counts: `zesassige afwijkingen ${sixAxis}; cellen ${perAxis || '?'}`,
    cells: delta.replace(/^CELLDELTA p6 /, '') || '?',
  });
  if (status.startsWith('ROOD')) for (const line of failures.slice(0, 20)) console.log(`     ${line}`);
}

// ── MS Project-profiel ────────────────────────────────────────────────────────────────────────
{
  const mpp = run('msp-mpp-fidelity', ['check-mpp-fidelity.ts'], process.env);
  const ok = mpp.lines.find((line) => line.startsWith('OK  mpp-fidelity: alle checks groen'));
  const goalRed = mpp.lines.filter((line) => line.includes('[GOAL_ZERO_DEVIATIONS')).length;
  const scanned = mpp.lines.filter((line) => /^\s+\. \[(corpus|crawl)\] \d+ bestand/.test(line)).map((line) => line.trim().replace(/^\. /, ''));
  const failures = failureLines(mpp.lines);
  const status = mpp.exit === 0 && ok ? 'GROEN' : `ROOD (${failures.length} faalregel(s))`;
  if (status.startsWith('ROOD')) red = true;
  rows.push({
    profile: 'MS Project', part: 'mpp-fidelity (start/einde, 2 assen)', exit: String(mpp.exit), status,
    counts: `${ok ? ok.replace(/^.*\((\d+)\)$/, '$1 checks') : '?'}; GOAL_ZERO-rood ${goalRed}; ${scanned.join(', ')}`,
    cells: 'n.v.t. — baseline op nul, elke tellingenpin is een cel-poort',
  });
  if (status.startsWith('ROOD')) for (const line of failures.slice(0, 20)) console.log(`     ${line}`);
}

// ── Corpusloze vangrails ──────────────────────────────────────────────────────────────────────
{
  const env = { ...process.env };
  delete env.OPS_XER_CORPUS;
  const guard = run('vangrails', ['check-xer-corpusless-fidelity-gate.ts', 'check-fidelity-cells-gate.ts'], env);
  const failures = failureLines(guard.lines);
  const status = guard.exit === 0 ? 'GROEN' : `ROOD (${failures.length} faalregel(s))`;
  if (status.startsWith('ROOD')) red = true;
  const cells = guard.lines.find((line) => line.includes('xer-product-fidelity-cells.json:')) ?? '';
  rows.push({
    profile: '(corpusloos)', part: 'X12-eindvangrail + cel-baselinepoort', exit: String(guard.exit), status,
    counts: cells.trim().replace(/^\. /, '') || '-', cells: '-',
  });
  if (status.startsWith('ROOD')) for (const line of failures.slice(0, 20)) console.log(`     ${line}`);
}

// ── Optioneel: volledige corpusloze suite ─────────────────────────────────────────────────────
if (FULL) {
  const env = { ...process.env };
  delete env.OPS_XER_CORPUS;
  const suite = run('planning-suite', [], env);
  const failures = failureLines(suite.lines);
  const status = suite.exit === 0 ? 'GROEN' : `ROOD (${failures.length} faalregel(s))`;
  if (status.startsWith('ROOD')) red = true;
  rows.push({ profile: 'OPS', part: 'volledige planningssuite (corpusloos)', exit: String(suite.exit), status, counts: '-', cells: '-' });
  if (status.startsWith('ROOD')) for (const line of failures.slice(0, 20)) console.log(`     ${line}`);
}

console.log('\nmeasure:profiles — regel A per profiel');
const header = ['profiel', 'meting', 'exit', 'status', 'tellingen', 'cel-delta'];
const table = [header, ...rows.map((row) => [row.profile, row.part, row.exit, row.status, row.counts, row.cells])];
const widths = header.map((_, index) => Math.min(70, Math.max(...table.map((cells) => cells[index].length))));
for (const [index, cells] of table.entries()) {
  console.log(cells.map((cell, column) => cell.padEnd(widths[column])).join(' | '));
  if (index === 0) console.log(widths.map((width) => '-'.repeat(width)).join('-|-'));
}
console.log('\nHet MS Project-orakel meet alleen start en einde (twee assen); het P6-orakel zes assen plus drivingPath (rapportage).');
if (!FULL) console.log('De volledige corpusloze suite is niet gedraaid (alleen met --full; hij draait al in `npm run verify`).');
console.log(red ? 'UITSLAG: ROOD — minstens één onderdeel rood' : 'UITSLAG: regel A gehouden onder elk gemeten profiel');
process.exit(red ? 1 : 0);
