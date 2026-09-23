#!/usr/bin/env node
// `npm run measure:profiles` — de landingsmeting van regel A (rekenprofielen-spec §2 besluit 5, §5).
//
// Draait achter elkaar, elk als eigen `bash tests/planning/run.sh <check>`-aanroep (dus met eigen
// exitcode), en print daarna één samenvattingstabel per profiel:
//   P6-profiel          check-xer-product-fidelity-x12.ts mét OPS_XER_CORPUS: de cel-poort
//                       (xer-product-fidelity-cells.json, zeven poortassen) plus de drie nuldoelregels;
//   MS Project-profiel  check-mpp-fidelity.ts: GOAL_ZERO_DEVIATIONS en de per-bestand-tellingenpins.
//                       Het MS Project-orakel meet alleen start en einde (twee assen); omdat die
//                       baseline op nul staat is elke pin al een cel-poort, er is geen cel-bestand.
//                       Nul gescande bestanden is "niet gemeten" en dus rood (fail-closed);
//   vangrails           check-xer-corpusless-fidelity-gate.ts + check-fidelity-cells-gate.ts
//                       (corpusloos, bewaken de gecommitte baselines);
//   --full              daarna de volledige corpusloze planningssuite (zonder OPS_XER_CORPUS).
//                       Standaard NIET: die draait al in `npm run verify`, en machinebreed hoort er
//                       maar één zware run tegelijk te lopen.
//   --only=p6|msp|vangrails  draait alleen dat onderdeel (voor gerichte runs en de scripttest).
//
// Het oordeel per onderdeel staat in `measure-profiles-status.mjs` (rood is de standaard; zie daar
// voor de drie niet-rode X12-toestanden GROEN, NULDOEL en VERBETERD). `--strict` maakt ook een nog
// rode nuldoelregel rood. Kindprocessen krijgen nooit OPS_XER_CELLS_WRITE, OPS_XER_FIDELITY_REPORT of
// OPS_MPP_FIDELITY_REPORT (noch OPS_XER_V2_WRITE / OPS_XER_GATE_PINS) mee: een meting schrijft of herformatteert nooit per ongeluk iets.
//
// Exit 0 = regel A gehouden onder elk gemeten profiel, 1 = minstens één onderdeel rood.
// Niet in `verify`: corpusgebonden, en het corpus zit niet in de repo.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { childEnv, classifyMsp, classifyP6, failureLines, parseCellDelta } from './measure-profiles-status.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RUN = join(ROOT, 'tests', 'planning', 'run.sh');
const PARTS = ['p6', 'msp', 'vangrails'];
const argv = process.argv.slice(2);
const bad = argv.filter((arg) => arg !== '--full' && arg !== '--strict' && !/^--only=(p6|msp|vangrails)$/.test(arg));
if (bad.length > 0) {
  console.error(`onbekend argument: ${bad.join(' ')} (verwacht --full, --strict en/of --only=p6|msp|vangrails)`);
  process.exit(2);
}
const FULL = argv.includes('--full');
const STRICT = argv.includes('--strict');
const only = argv.find((arg) => arg.startsWith('--only='))?.slice('--only='.length);
const selected = new Set(only ? [only] : PARTS);

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

const rows = [];
let red = false;
function record(row, verdict) {
  rows.push({ ...row, status: verdict.status });
  if (!verdict.pass) {
    red = true;
    for (const line of verdict.failures.slice(0, 20)) console.log(`     ${line.slice(0, 400)}`);
  }
}

// ── P6-profiel ────────────────────────────────────────────────────────────────────────────────
if (selected.has('p6')) {
  const corpus = process.env.OPS_XER_CORPUS;
  if (!corpus || !existsSync(corpus)) {
    console.error('OPS_XER_CORPUS ontbreekt of bestaat niet — zonder corpus meet het P6-profiel niets');
    record({ profile: 'P6', part: 'X12 productfidelity', exit: '-', counts: '-', cells: '-' },
      { status: 'ROOD (geen corpus)', pass: false, failures: [] });
  } else {
    // Rapportage-only: houdt de p6Computed-sidecar vers. Exitcode wordt geprint, niet in het oordeel
    // meegenomen — een verouderde sidecar maakt alleen de splitsing onbetrouwbaar, niet de cel-poort.
    const side = spawnSync(process.execPath, ['scripts/run-ts.mjs', 'scripts/xer-p6-computed.ts', '--check'], { encoding: 'utf8', env: process.env });
    console.log(`INFO p6Computed-sidecar --check exit ${side.status ?? side.signal}: ${`${side.stdout ?? ''}${side.stderr ?? ''}`.trim().split('\n').join(' | ')}`);
    const x12 = run('p6-x12', ['check-xer-product-fidelity-x12.ts'], childEnv(process.env));
    const verdict = classifyP6({ exit: x12.exit, lines: x12.lines, strict: STRICT });
    const perAxis = (x12.lines.find((line) => line.startsWith('OK  X12 cel-baseline (regel A):')) ?? '')
      .replace(/^.*inexact per as /, '').replace(/;.*$/, '');
    const goal = x12.lines.find((line) => line.startsWith('XX X12 nuldoel is baseline-onafhankelijk: totaal zesassige'));
    const sixAxis = goal ? goal.replace(/^.*kreeg /, '') : (x12.exit === 0 ? '0' : '?');
    // Rapportage-only splitsing naar p6Computed (scripts/xer-p6-computed.ts); geen invloed op het oordeel.
    const split = (x12.lines.find((line) => line.startsWith('INFO X12 split')) ?? '').replace(/^INFO X12 split \(rapportage, geen poort[^)]*\): /, '');
    record({
      profile: 'P6', part: 'X12 productfidelity (cel-poort + nuldoel)', exit: String(x12.exit),
      counts: `zesassige afwijkingen ${sixAxis}${split ? ` (${split})` : ''}; cellen ${perAxis || '?'}`,
      cells: parseCellDelta(x12.lines)?.line ?? '?',
    }, verdict);
  }
}

// ── MS Project-profiel ────────────────────────────────────────────────────────────────────────
if (selected.has('msp')) {
  const mpp = run('msp-mpp-fidelity', ['check-mpp-fidelity.ts'], childEnv(process.env));
  const verdict = classifyMsp({ exit: mpp.exit, lines: mpp.lines });
  const ok = mpp.lines.find((line) => line.startsWith('OK  mpp-fidelity: alle checks groen'));
  const goalRed = mpp.lines.filter((line) => line.includes('[GOAL_ZERO_DEVIATIONS')).length;
  record({
    profile: 'MS Project', part: 'mpp-fidelity (start/einde, 2 assen)', exit: String(mpp.exit),
    counts: `${ok ? ok.replace(/^.*\((\d+)\)$/, '$1 checks') : '?'}; GOAL_ZERO-rood ${goalRed}; ${verdict.scanned} bestand(en) gescand`,
    cells: 'n.v.t. — baseline op nul, elke tellingenpin is een cel-poort',
  }, verdict);
}

// ── Corpusloze vangrails ──────────────────────────────────────────────────────────────────────
if (selected.has('vangrails')) {
  const guard = run('vangrails', ['check-xer-corpusless-fidelity-gate.ts', 'check-fidelity-cells-gate.ts'],
    childEnv(process.env, { dropXerCorpus: true }));
  const failures = failureLines(guard.lines);
  const cells = guard.lines.find((line) => line.includes('xer-product-fidelity-cells.json:')) ?? '';
  record({
    profile: '(corpusloos)', part: 'X12-eindvangrail + cel-baselinepoort', exit: String(guard.exit),
    counts: cells.trim().replace(/^\. /, '') || '-', cells: '-',
  }, guard.exit === 0 ? { status: 'GROEN', pass: true, failures } : { status: `ROOD (${failures.length} faalregel(s))`, pass: false, failures });
}

// ── Optioneel: volledige corpusloze suite ─────────────────────────────────────────────────────
if (FULL) {
  const suite = run('planning-suite', [], childEnv(process.env, { dropXerCorpus: true }));
  const failures = failureLines(suite.lines);
  record({ profile: 'OPS', part: 'volledige planningssuite (corpusloos)', exit: String(suite.exit), counts: '-', cells: '-' },
    suite.exit === 0 ? { status: 'GROEN', pass: true, failures } : { status: `ROOD (${failures.length} faalregel(s))`, pass: false, failures });
}

console.log('\nmeasure:profiles — regel A per profiel');
const header = ['profiel', 'meting', 'exit', 'status', 'tellingen', 'cel-delta'];
const table = [header, ...rows.map((row) => [row.profile, row.part, row.exit, row.status, row.counts, row.cells])];
const widths = header.map((_, index) => Math.min(70, Math.max(...table.map((cells) => cells[index].length))));
for (const [index, cells] of table.entries()) {
  console.log(cells.map((cell, column) => cell.padEnd(widths[column])).join(' | '));
  if (index === 0) console.log(widths.map((width) => '-'.repeat(width)).join('-|-'));
}
console.log('\nHet MS Project-orakel meet alleen start en einde (twee assen). Het P6-orakel meet zes assen plus '
  + 'drivingPath als zevende poort-as (cel-ratchet; niet in het zesassige nuldoel-getal).');
if (!FULL) console.log('De volledige corpusloze suite is niet gedraaid (alleen met --full; hij draait al in `npm run verify`).');
if (rows.some((row) => row.status.startsWith('VERBETERD (grootte)'))) {
  console.log('VERBETERD (grootte) is exit 0, maar commit alleen mét herpin van de cellen: OPS_XER_CELLS_WRITE=1 '
    + '(v2 en de gate-pins tellen emmers en veranderen niet), daarna de vangrails tot groen — recept in scripts/README.md.');
} else if (rows.some((row) => row.status.startsWith('VERBETERD'))) {
  console.log('VERBETERD is exit 0, maar commit alleen mét herpin, in deze volgorde en in één commit: '
    + '(1) OPS_XER_V2_WRITE=1, (2) OPS_XER_CELLS_WRITE=1, (3) OPS_XER_GATE_PINS=write op '
    + 'check-xer-corpusless-fidelity-gate.ts plus de HERPIN-toelichting in EXPECTED, (4) de vangrails '
    + 'draaien tot groen — recept in scripts/README.md.');
}
const scope = only ? ' (GERICHTE RUN — niet alle vangrails gedraaid)' : '';
console.log(red ? `UITSLAG${scope}: ROOD — minstens één onderdeel rood` : `UITSLAG${scope}: regel A gehouden onder elk gemeten profiel`);
process.exit(red ? 1 : 0);
