import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { differences, FLAGS, inputHashes, loadFiles, runBoundaries, runCases, sha256, type Recording, type StepTrace } from './bomEigenBestand';

const repo = join(dirname(fileURLToPath(import.meta.url)), '../..');
const recording = JSON.parse(readFileSync(join(repo, 'tests/planning/fixtures/main-bom-eigen-bestand.json'), 'utf8')) as Recording;
const root = mkdtempSync(join(tmpdir(), 'ops-bom-eigen-'));
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

const UNREADABLE = ['error:notifications.ifcUnreadableTargetSave'];
const CHANGED = ['error:notifications.ifcForeignTargetChanged'];

try {
  const files = await loadFiles(repo);
  const inputs = inputHashes(files);
  const changed = [...new Set([...Object.keys(recording.inputs), ...Object.keys(inputs)])].filter(k => recording.inputs[k] !== inputs[k]);
  check(`2212 de invoer is die van de opname van main ${recording.basis.slice(0, 9)}`,
    changed.map(k => `${k} is veranderd; maak de opname opnieuw met scripts/proef/maak-main-bom-eigen-bestand.mjs`));
  if (changed.length === 0) {
    const pr = await runCases(root, files, true);
    for (const name of new Set([...Object.keys(recording.cases), ...Object.keys(pr)])) {
      const main = recording.cases[name], mine = pr[name];
      check(`2212 ${name}: met BOM zoals main zonder BOM`, !main ? ['niet in de opname van main'] : !mine ? ['niet gedraaid'] : differences(main, mine));
    }

    const left = Object.entries(recording.cases).flatMap(([name, steps]) => steps.flatMap((step, i) => (
      (step.extra as { extern?: string } | undefined)?.extern === 'byte voor byte' ? [{ name, i }] : [])));
    check(`2212 waar main de bytes van een ander liet staan, staan ze er na de PR byte voor byte nog (${left.length} gevallen)`,
      left.filter(({ name, i }) => (pr[name]?.[i]?.extra as { extern?: string } | undefined)?.extern !== 'byte voor byte').map(({ name }) => name));

    const twelve = (['pad', 'handle'] as const).flatMap(kind => (['Ctrl+S', 'Automatisch opslaan'] as const).flatMap(how => FLAGS.map(flag =>
      `LF | ${kind} | hier | ${how}, geopend: bij lezing-1: een andere planning met BOM, ${flag}`)));
    check(`2212 de twaalf gevallen van de review van ronde 3: main en de PR weigeren en laten de andere planning met BOM staan`,
      twelve.flatMap(name => [recording.cases[name], pr[name]].flatMap((steps, side) => {
        const last = steps?.at(-1);
        const extern = (last?.extra as { extern?: string } | undefined)?.extern;
        return last && last.outcome === false && extern === 'byte voor byte' ? [] : [`${side ? 'PR' : 'main'} ${name}`];
      })));

    const edges = await runBoundaries(root, files, true);
    const opened = sha256(files.lf), other = sha256(files.other);
    for (const kind of ['pad', 'handle'] as const) {
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
    expect('2359 grens site: main slaat een nieuwe versie op', 'main', recording.boundaries['site | Ctrl+S'], { outcome: true, notices: [] });
    expect('2359 grens site: de PR weigert het als onleesbaar doel', 'PR', edges['site | Ctrl+S'], { outcome: false, notices: UNREADABLE });
    const unknown = Object.keys(edges).filter(name => !(name in recording.boundaries));
    check('2212 de grensgevallen staan allemaal in de opname', unknown);
  }
} finally { rmSync(root, { recursive: true, force: true }); }
console.log(`Eigen bestand met een BOM tegen main ${recording.basis.slice(0, 9)}: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
