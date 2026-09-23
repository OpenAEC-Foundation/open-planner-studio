// Corpusloze toetsing van `npm run measure:profiles`: het oordeel per profiel (pure functies) en één
// echte scriptrun die bewijst dat het MS Project-profiel fail-closed is — zonder één gescand `.mpp`-
// bestand is de uitslag rood, niet groen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  childEnv, classifyMsp, classifyP6, KNOWN_GOAL_PREFIXES, parseCellDelta, V2_EQUALITY_PREFIX, VERBETERD_GROOTTE_STATUS, VERBETERD_STATUS,
} from '../../scripts/measure-profiles-status.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const GOAL = KNOWN_GOAL_PREFIXES.map((prefix, index) => `${prefix}verwacht ${index === 2 ? '0' : 'true'}, kreeg ${index === 2 ? '15056' : 'false'}`);
const CELL_OK = 'OK  X12 cel-baseline (regel A): geen nieuwe of verslechterde cel over 34 bestanden; inexact per as drivingPath=417';
const delta = (nieuw, verslechterd, verbeterd, onmeetbaar = 0, groter = 0, kleiner = 0) =>
  `CELLDELTA p6 nieuw=${nieuw} verslechterd=${verslechterd} groter=${groter} verbeterd=${verbeterd} kleiner=${kleiner} onmeetbaar=${onmeetbaar} onbekend=0 ongemeten=0 schuld=0 totaal=15473`;
const COVERAGE = 'XX X12 meetbaarheid/dekking wijkt af van v2: 0611f9054a4b tf.measurable v2=1234 nu=1233';
const V2 = `${V2_EQUALITY_PREFIX}verwacht {…}, kreeg {…}`;

test('P6: alleen de drie nuldoelregels rood met groene cel-poort ⇒ NULDOEL, geslaagd', () => {
  const verdict = classifyP6({ exit: 1, lines: [delta(0, 0, 0), CELL_OK, ...GOAL] });
  assert.equal(verdict.status, 'NULDOEL (regel A gehouden)');
  assert.equal(verdict.pass, true);
});

test('P6: --strict maakt de nuldoeltoestand rood', () => {
  assert.equal(classifyP6({ exit: 1, lines: [delta(0, 0, 0), CELL_OK, ...GOAL], strict: true }).pass, false);
});

test('P6: zuivere verbetering (alleen v2-gelijkheid extra rood, verbeterd>0) ⇒ VERBETERD, geslaagd', () => {
  const verdict = classifyP6({ exit: 1, lines: [delta(0, 0, 3), CELL_OK, ...GOAL, V2] });
  assert.equal(verdict.status, VERBETERD_STATUS);
  assert.match(verdict.status, /exit 0, maar commit alleen mét herpin v2 \+ cellen/);
  assert.equal(verdict.pass, true);
});

test('P6: v2-afwijking zonder verbeterde cel ⇒ rood', () => {
  assert.equal(classifyP6({ exit: 1, lines: [delta(0, 0, 0), CELL_OK, ...GOAL, V2] }).pass, false);
});

test('P6: v2-afwijking met een nieuwe of verslechterde cel ⇒ rood', () => {
  assert.equal(classifyP6({ exit: 1, lines: [delta(1, 0, 3), CELL_OK, ...GOAL, V2] }).pass, false);
  assert.equal(classifyP6({ exit: 1, lines: [delta(0, 1, 3), CELL_OK, ...GOAL, V2] }).pass, false);
});

test('P6: blinder orakel — meetbaarheid/dekking wijkt af, of een onmeetbaar geworden cel ⇒ rood', () => {
  // Precies de reviewer-mutant: verbeterd=1 en v2 rood, maar de meetbaarheid is gekrompen.
  assert.equal(classifyP6({ exit: 1, lines: [delta(0, 0, 1), CELL_OK, ...GOAL, V2, COVERAGE] }).pass, false);
  assert.equal(classifyP6({ exit: 1, lines: [delta(0, 0, 1, 1), CELL_OK, ...GOAL, V2] }).pass, false);
});

test('P6: elke andere faalregel of een stacktrace ⇒ rood', () => {
  assert.equal(classifyP6({ exit: 1, lines: [delta(0, 0, 3), CELL_OK, ...GOAL, V2, 'XX X12 iets anders'] }).pass, false);
  assert.equal(classifyP6({ exit: 1, lines: [delta(0, 0, 0), CELL_OK, ...GOAL, '    at run (file.mjs:1:2)'] }).pass, false);
});

test('P6: geen cel-OK-regel of geen cel-delta ⇒ rood', () => {
  assert.equal(classifyP6({ exit: 1, lines: [delta(0, 0, 0), ...GOAL] }).pass, false);
  assert.equal(classifyP6({ exit: 1, lines: [CELL_OK, ...GOAL] }).pass, false);
});

test('P6: exit 0 zonder faalregels met groene cel-poort ⇒ GROEN', () => {
  assert.equal(classifyP6({ exit: 0, lines: [delta(0, 0, 0), CELL_OK] }).status, 'GROEN');
});

test('P6: grootte-ratchet — een grotere cel ⇒ rood, ook naast een verbetering', () => {
  assert.equal(classifyP6({ exit: 1, lines: [delta(0, 0, 0, 0, 1), CELL_OK, ...GOAL] }).pass, false);
  assert.equal(classifyP6({ exit: 1, lines: [delta(0, 0, 3, 0, 1), CELL_OK, ...GOAL, V2] }).pass, false);
  assert.equal(classifyP6({ exit: 1, lines: [delta(0, 0, 0, 0, 1, 5), CELL_OK, ...GOAL] }).pass, false);
});

test('P6: alleen kleinere cellen (geen v2-afwijking) ⇒ VERBETERD (grootte), geslaagd', () => {
  const verdict = classifyP6({ exit: 1, lines: [delta(0, 0, 0, 0, 0, 4), CELL_OK, ...GOAL] });
  assert.equal(verdict.status, VERBETERD_GROOTTE_STATUS);
  assert.equal(verdict.pass, true);
});

test('P6: v2-afwijking met alleen kleinere cellen (verbeterd=0) ⇒ rood', () => {
  assert.equal(classifyP6({ exit: 1, lines: [delta(0, 0, 0, 0, 0, 4), CELL_OK, ...GOAL, V2] }).pass, false);
});

test('P6: oude cel-delta-regel zonder groter=/kleiner= ⇒ niet te lezen, rood', () => {
  const old = 'CELLDELTA p6 nieuw=0 verslechterd=0 verbeterd=0 onmeetbaar=0 onbekend=0 ongemeten=0 totaal=15473';
  assert.equal(parseCellDelta([old]), undefined);
  assert.equal(classifyP6({ exit: 1, lines: [old, CELL_OK, ...GOAL] }).pass, false);
});

test('P6: cel-delta-regel zonder schuld= ⇒ niet te lezen, rood; met schuld=14 ⇒ NULDOEL blijft mogelijk', () => {
  const noDebt = 'CELLDELTA p6 nieuw=0 verslechterd=0 groter=0 verbeterd=0 kleiner=0 onmeetbaar=0 onbekend=0 ongemeten=0 totaal=604';
  assert.equal(parseCellDelta([noDebt]), undefined);
  assert.equal(classifyP6({ exit: 1, lines: [noDebt, CELL_OK, ...GOAL] }).pass, false);
  const withDebt = noDebt.replace(' totaal=', ' schuld=14 totaal=');
  assert.equal(parseCellDelta([withDebt]).schuld, 14);
  assert.equal(classifyP6({ exit: 1, lines: [withDebt, CELL_OK, ...GOAL] }).status, 'NULDOEL (regel A gehouden)');
});

test('MS Project: nul gescande bestanden is rood, ook bij exit 0 en een OK-regel', () => {
  const verdict = classifyMsp({ exit: 0, lines: ['OK  mpp-fidelity: alle checks groen (40)'] });
  assert.equal(verdict.status, 'ROOD (niet gemeten)');
  assert.equal(verdict.pass, false);
});

test('MS Project: gescande bestanden, exit 0 en OK-regel ⇒ GROEN', () => {
  const verdict = classifyMsp({ exit: 0, lines: ['   . [crawl] 658 bestand(en) gescand', 'OK  mpp-fidelity: alle checks groen (2196)'] });
  assert.equal(verdict.status, 'GROEN');
  assert.equal(verdict.scanned, 658);
});

test('kindprocessen krijgen geen schrijf- of rapportmodus mee', () => {
  const env = childEnv({
    PATH: '/bin', OPS_XER_CORPUS: '/c', OPS_XER_CELLS_WRITE: '1', OPS_XER_V2_WRITE: '1', OPS_XER_GATE_PINS: 'write',
    OPS_XER_FIDELITY_REPORT: 'baseline', OPS_MPP_FIDELITY_REPORT: 'baseline',
  });
  assert.deepEqual(env, { PATH: '/bin', OPS_XER_CORPUS: '/c' });
  assert.equal('OPS_XER_CORPUS' in childEnv({ OPS_XER_CORPUS: '/c' }, { dropXerCorpus: true }), false);
});

test('scriptrun: MS Project-profiel met lege corpuspaden ⇒ ROOD (niet gemeten), exit 1', () => {
  const result = spawnSync(process.execPath, [join(ROOT, 'scripts', 'measure-profiles.mjs'), '--only=msp'], {
    cwd: ROOT, encoding: 'utf8', timeout: 300_000,
    env: {
      ...process.env,
      OPS_MPP_CORPUS: '/nonexistent/ops-measure-profiles-test',
      OPS_MPP_CRAWL: '/nonexistent/ops-measure-profiles-test',
      // Moet genegeerd worden: anders zou de mpp-check in baselinemodus stil exit 0 geven.
      OPS_MPP_FIDELITY_REPORT: 'baseline',
    },
  });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /MS Project\s+\|.*\|\s+ROOD \(niet gemeten\)/);
  assert.match(result.stdout, /UITSLAG \(GERICHTE RUN — niet alle vangrails gedraaid\): ROOD/);
});
