import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  atBomVersion, differences, inputHashes, isSwitch, loadFiles, recorded, runBoundaries, runCases, sha256, switchBaseline, SWITCHES,
  type Recording, type StepTrace,
} from './bomEigenBestand';

const repo = join(dirname(fileURLToPath(import.meta.url)), '../..');
const recording = JSON.parse(readFileSync(join(repo, 'tests/planning/fixtures/main-bom-eigen-bestand.json'), 'utf8')) as Recording;
const root = mkdtempSync(join(tmpdir(), 'ops-bom-eigen-'));
const only = process.env.OPS_BOM_GEVALLEN ? new RegExp(process.env.OPS_BOM_GEVALLEN) : undefined;
let passed = 0, failed = 0;
function check(name: string, found: readonly string[]) {
  if (found.length === 0) { passed++; console.log(`OK ${name}`); }
  else { failed++; console.error(`XX ${name}: ${found.join(' | ').slice(0, 2000)}`); }
}

interface Expected { readonly outcome: boolean; readonly notices: readonly string[]; readonly disk?: string }
function expect(name: string, side: string, steps: readonly StepTrace[] | undefined, expected: Expected) {
  const last = steps?.at(-1);
  if (!last) return check(`${name} (${side})`, ['geen uitkomst']);
  const found: string[] = [];
  if (last.outcome !== expected.outcome) found.push(`uitkomst ${last.outcome}`);
  const keys = last.notices.map(notice => notice.split(' ')[0]);
  if (JSON.stringify(keys) !== JSON.stringify(expected.notices)) found.push(`meldingen ${JSON.stringify(last.notices)}`);
  if (expected.disk && last.disk !== expected.disk) found.push(`doel ${last.disk}`);
  check(`${name} (${side})`, found);
}

const extern = (step: StepTrace | undefined) => (step?.extra as { extern?: string } | undefined)?.extern;
const flipOf = (name: string) => /; wissel (.+) bij [^;]+$/.exec(name)?.[1] ?? null;
const UNREADABLE = ['error:notifications.ifcUnreadableTargetSave'];
const CHANGED = ['error:notifications.ifcForeignTargetChanged'];

try {
  const files = await loadFiles(repo);
  const inputs = inputHashes(files);
  const changed = [...new Set([...Object.keys(recording.inputs), ...Object.keys(inputs)])].filter(k => recording.inputs[k] !== inputs[k]);
  check(`2212 de invoer is die van de opname van main ${recording.basis.slice(0, 9)}`,
    changed.map(k => `${k} is veranderd; maak de opname opnieuw met scripts/proef/maak-main-bom-eigen-bestand.mjs`));
  if (changed.length === 0) {
    const pr = await runCases(root, files, true, only);
    const names = only ? Object.keys(pr) : [...new Set([...Object.keys(recording.cases), ...Object.keys(pr)])];
    const expectation = (name: string) => recorded(recording, isSwitch(name) ? switchBaseline(name) : name);
    let switches = 0, fired = 0;
    const corner = new Map<string, number>();
    for (const name of names) {
      const mine = pr[name];
      if (atBomVersion(name)) {
        check(`2212 ${name}: wat er bij de hash van de BOM-versie op het doel komt, wordt niet overschreven`,
          !mine ? ['niet gedraaid'] : mine.flatMap(step => (extern(step) === 'overschreven' ? [`${step.step}: overschreven`] : [])));
        continue;
      }
      const main = expectation(name);
      const flip = flipOf(name);
      check(`2212 ${name}: ${flip ? 'met een wissel zoals dezelfde poging zonder wissel op main' : 'met BOM zoals main zonder BOM'}`,
        !main ? ['niet in de opname van main'] : !mine ? ['niet gedraaid'] : differences(main, mine, flip));
      if (!flip || !mine) continue;
      switches++;
      if (mine.some(step => (step.extra as { ingreep?: boolean } | undefined)?.ingreep === true)) fired++;
      const before = recorded(recording, name)?.at(-1), after = mine.at(-1);
      if (before && after && (before.outcome !== after.outcome || JSON.stringify(before.notices) !== JSON.stringify(after.notices)
        || before.disk !== after.disk)) {
        const label = (step: StepTrace) => `${step.outcome ? 'schrijft' : 'weigert'}${step.notices.length ? ` (${step.notices.map(n => n.split(' ')[0].replace('error:notifications.', '')).join(', ')})` : ''}`;
        const key = `wissel ${flip}: main ${label(before)} → PR ${label(after)}`;
        corner.set(key, (corner.get(key) ?? 0) + 1);
      }
    }
    console.log(`..  ${switches} gevallen met een flagwissel, waarvan ${fired} met de wissel echt midden in de poging`);
    for (const [key, count] of [...corner].sort()) console.log(`..  hoek van de flagwissel, anders dan main nu: ${count}× ${key}`);

    const left = names.flatMap(name => {
      if (atBomVersion(name)) return [];
      return (expectation(name) ?? []).flatMap((step, i) => (extern(step) === 'byte voor byte' ? [{ name, i }] : []));
    });
    check(`2212 waar main de bytes van een ander liet staan, staan ze er na de PR byte voor byte nog (${left.length} gevallen)`,
      left.filter(({ name, i }) => extern(pr[name]?.[i]) !== 'byte voor byte').map(({ name }) => name));

    const kinds = ['pad', 'handle'] as const, routes = ['Ctrl+S', 'Automatisch opslaan'] as const;
    const twelve = kinds.flatMap(kind => routes.flatMap(how => ['', ...SWITCHES.map(flip => `; wissel ${flip} bij lezing-1`)].map(flip =>
      `LF | ${kind} | hier | ${how}, geopend, flag aan: een andere planning met BOM bij lezing-1${flip}`)));
    const eight = kinds.flatMap(kind => (['hier', 'worker'] as const).flatMap(compute => routes.map(how =>
      `LF | ${kind} | ${compute} | ${how}, geopend, flag aan: een gebouwmodel zonder BOM bij bomversie; wissel uit bij lezing-1`)))
      .filter(name => !only || only.test(name));
    check(`2212 de acht gevallen van de review van ronde 4 (${eight.length} gedraaid): het gebouwmodel dat tijdens de BOM-hash verschijnt, blijft byte voor byte staan`,
      eight.filter(name => extern(pr[name]?.at(-1)) !== 'byte voor byte').map(name => `PR ${name}`));
    if (!only) {
      check('2212 de twaalf gevallen van de review van ronde 3: weigeren en de andere planning met BOM laten staan, op main en de PR',
        twelve.flatMap(name => [expectation(name), pr[name]].flatMap((steps, side) => {
          const last = steps?.at(-1);
          return last && last.outcome === false && extern(last) === 'byte voor byte' ? [] : [`${side ? 'PR' : 'main'} ${name}`];
        })));
      const atHash = names.filter(atBomVersion).map(name => extern(pr[name]?.at(-1)) ?? 'geen');
      console.log(`..  ingreep bij de hash van de BOM-versie: ${atHash.length} gevallen, ${atHash.filter(e => e === 'byte voor byte').length} met de bytes van de ander nog op het doel, ${atHash.filter(e => e === 'niet geplaatst').length} zonder die hash`);
    }

    const edges = await runBoundaries(root, files, true);
    const opened = sha256(files.lf), other = sha256(files.other);
    for (const kind of kinds) {
      const at = (name: string) => `${kind} | ${name}`;
      const wereld = at('extern een andere planning met BOM, in de wereld van het bestand');
      expect(`2212 grens ${wereld}: main weigert het als gewijzigd doel`, 'main', recording.boundaries[wereld], { outcome: false, notices: CHANGED, disk: other });
      expect(`2212 grens ${wereld}: de PR weigert het als onleesbaar doel`, 'PR', edges[wereld], { outcome: false, notices: UNREADABLE, disk: other });
      const terug = at('extern de geopende planning terug zonder BOM');
      expect(`2212 grens ${terug}: main schrijft`, 'main', recording.boundaries[terug], { outcome: true, notices: [] });
      expect(`2212 grens ${terug}: de PR weigert het als gewijzigd doel`, 'PR', edges[terug], { outcome: false, notices: CHANGED, disk: opened });
      const onbekend = at('onbekende versie na flag uit en aan');
      expect(`2358 grens ${onbekend}: main schrijft`, 'main', recording.boundaries[onbekend], { outcome: true, notices: [] });
      expect(`2358 grens ${onbekend}: de PR weigert het als onleesbaar doel`, 'PR', edges[onbekend], { outcome: false, notices: UNREADABLE });
    }
    const kiezer = 'handle | recht geweigerd, een andere planning met BOM in de wereld van het bestand';
    expect(`2358 grens ${kiezer}: main opent de kiezer en slaat op`, 'main', recording.boundaries[kiezer],
      { outcome: true, notices: ['info:notifications.browserCannotOverwrite'] });
    expect(`2358 grens ${kiezer}: de PR weigert het oude bestand als onleesbaar doel`, 'PR', edges[kiezer], { outcome: false, notices: UNREADABLE });
    expect('2359 grens site: main slaat een nieuwe versie op', 'main', recording.boundaries['site | Ctrl+S'], { outcome: true, notices: [] });
    expect('2359 grens site: de PR weigert het als onleesbaar doel', 'PR', edges['site | Ctrl+S'], { outcome: false, notices: UNREADABLE });
    check('2212 de grensgevallen staan allemaal in de opname', Object.keys(edges).filter(name => !(name in recording.boundaries)));
  }
} finally { rmSync(root, { recursive: true, force: true }); }
console.log(`Eigen bestand met een BOM tegen main ${recording.basis.slice(0, 9)}: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
