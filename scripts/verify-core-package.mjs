#!/usr/bin/env node
// Poort voor het gebouwde pakket `@openaec/open-planner-core` (docs/headless-kern.md).
//
// Bouwt het pakket in een tijdelijke map, maakt er met `npm pack` een tarball van, installeert die
// in een kopie van `headless/consumer-example/` en draait het voorbeeld zoals een externe gebruiker
// het zou doen. Daarna een typecheck van een kleine TypeScript-consument tegen de meegeleverde
// declaraties. Geen netwerk nodig: het pakket heeft geen dependencies.
//
// De rekensemantiek (kern = app voor alle voorbeeldbestanden) toetst
// tests/planning/check-headless-core.ts; hier gaat het om het pakket als geheel.
//
//   npm run verify:core-package      # exit 0 = groen
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = mkdtempSync(join(tmpdir(), 'ops-core-package-'));
const diffs = [];
let checks = 0;
const ok = (label, condition, detail = '') => {
  checks++;
  if (!condition) diffs.push(`${label}${detail ? `: ${detail}` : ''}`);
};
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32' });
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}`, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}
function must(label, r) {
  if (r.status !== 0) {
    console.log(`XX ${label} faalde (exit ${r.status}):\n${r.out}`);
    rmSync(work, { recursive: true, force: true });
    process.exit(1);
  }
  return r;
}

// Verwachte uitkomst voor één vast voorbeeld. Wijzigt het voorbeeld (`npm run gen:examples`), pas
// deze waarden dan aan; de app-gelijkheid zelf bewaakt check-headless-core.ts.
const EXAMPLE = join(root, 'examples', '01-grachtenpand-amsterdam.ifc');
const EXPECTED = { name: 'New-Build Canal House, Amsterdam', start: '2027-03-01', finish: '2028-01-12T16:00', tasks: 51 };

try {
  const appPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const pkgDir = join(work, 'pkg');

  // 1. Bouwen (met de grenscontrole op de bundel) en inpakken.
  must('build:core', run(process.execPath, [join(root, 'scripts/build-core.mjs'), '--out', pkgDir], root));
  const built = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  ok('1 naam', built.name === '@openaec/open-planner-core', built.name);
  ok('1a versie = appversie', built.version === appPkg.version, `${built.version} ≠ ${appPkg.version}`);
  ok('1b licentie = repolicentie', built.license === appPkg.license, built.license);
  ok('1c exports wijst naar types en ESM', built.exports?.['.']?.types === './index.d.ts' && built.exports?.['.']?.import === './index.mjs');
  ok('1d geen runtime-dependencies', !built.dependencies && !built.peerDependencies);

  const pack = must('npm pack', run(npm, ['pack', pkgDir, '--pack-destination', work, '--json'], work));
  const packed = JSON.parse(pack.stdout)[0];
  const tarball = join(work, packed.filename);
  const packedFiles = packed.files.map((f) => f.path).sort();
  ok('2 tarball bevat precies de pakketbestanden',
    JSON.stringify(packedFiles) === JSON.stringify(['LICENSE', 'LICENSE.GPL', 'README.md', 'THIRD-PARTY-NOTICES.md', 'api.d.ts', 'index.d.ts', 'index.mjs', 'package.json']),
    packedFiles.join(', '));

  // Licenties van de meegebundelde dependencies: elk pakket dat de bundel bevat, met zijn eigen
  // licentietekst uit node_modules. De verwachte lijst komt uit de lockfile-versies, niet uit de bouw.
  const notices = readFileSync(join(pkgDir, 'THIRD-PARTY-NOTICES.md'), 'utf8');
  for (const dep of ['zustand', 'immer', 'i18next']) {
    const meta = JSON.parse(readFileSync(join(root, 'node_modules', dep, 'package.json'), 'utf8'));
    const license = readFileSync(join(root, 'node_modules', dep, 'LICENSE'), 'utf8').trim();
    ok(`2a THIRD-PARTY-NOTICES noemt ${dep} ${meta.version} met de volledige licentietekst`,
      notices.includes(`## ${dep} ${meta.version}`) && notices.includes(license));
  }
  const listed = /Bundled packages: ([^\n]+)\./.exec(notices)?.[1] ?? '';
  ok('2b de notices noemen precies de gebundelde pakketten', listed === 'i18next, immer, zustand', listed);

  // 2. Het consumeervoorbeeld in een tijdelijke map, met het pakket uit de tarball.
  const consumer = join(work, 'consumer');
  cpSync(join(root, 'headless/consumer-example'), consumer, {
    recursive: true,
    filter: (src) => !/node_modules|package-lock\.json/.test(src),
  });
  const cpkg = JSON.parse(readFileSync(join(consumer, 'package.json'), 'utf8'));
  cpkg.dependencies['@openaec/open-planner-core'] = `file:${tarball}`;
  writeFileSync(join(consumer, 'package.json'), JSON.stringify(cpkg, null, 2));
  must('npm install', run(npm, ['install', '--no-audit', '--no-fund', '--ignore-scripts', '--prefer-offline'], consumer));
  ok('3 het pakket staat als gewone map in node_modules (geen link naar de repo)',
    existsSync(join(consumer, 'node_modules/@openaec/open-planner-core/index.mjs')));

  const outIfc = join(work, 'herberekend.ifc');
  const json = run(process.execPath, ['index.mjs', EXAMPLE, '--json', '--out', outIfc], consumer);
  ok('4 voorbeeld draait (exit 0)', json.status === 0, json.out.slice(0, 500));
  if (json.status === 0) {
    const s = JSON.parse(json.stdout);
    ok('4a formatVersion 1', s.formatVersion === 1);
    ok('4b projectnaam', s.project.name === EXPECTED.name, s.project.name);
    ok('4c start en einde', s.project.start === EXPECTED.start && s.project.finish === EXPECTED.finish,
      `${s.project.start} → ${s.project.finish}`);
    ok('4d aantal taken', s.counts.tasks === EXPECTED.tasks && s.tasks.length === EXPECTED.tasks, String(s.counts.tasks));
    ok('4e taakvelden', ['id', 'name', 'wbs', 'start', 'finish', 'totalFloat', 'critical'].every((k) => k in s.tasks[0]));
    ok('4f herberekend IFC geschreven', existsSync(outIfc) && readFileSync(outIfc, 'utf8').startsWith('ISO-10303-21;'));
  }

  const again = run(process.execPath, ['index.mjs', outIfc, '--json'], consumer);
  ok('5 herberekend IFC opent opnieuw met hetzelfde einde',
    again.status === 0 && JSON.parse(again.stdout).project.finish === EXPECTED.finish, again.out.slice(0, 300));

  const human = run(process.execPath, ['index.mjs', EXAMPLE], consumer);
  ok('6 leesbare uitvoer noemt versie en einde',
    human.status === 0 && human.stdout.includes(`open-planner-core ${appPkg.version}`) && human.stdout.includes(EXPECTED.finish),
    human.out.slice(0, 300));

  const badFile = join(work, 'kapot.ifc');
  writeFileSync(badFile, 'dit is geen IFC');
  const bad = run(process.execPath, ['index.mjs', badFile], consumer);
  ok('7 ongeldige invoer ⇒ exit 1 met code INVALID_INPUT', bad.status === 1 && bad.stderr.startsWith('INVALID_INPUT:'), bad.out);

  // 3. De typedeclaraties werken voor een TypeScript-consument (NodeNext, strict).
  writeFileSync(join(consumer, 'types-check.ts'), `
import { openIfc, PlannerCoreError, VERSION, type CoreErrorCode, type ScheduleSummary } from '@openaec/open-planner-core';
export async function use(text: string): Promise<string> {
  const doc = await openIfc(text);
  const s: ScheduleSummary = doc.schedule();
  const finish: string = s.project.finish;
  const ifc: string = doc.toIfc();
  return \`\${VERSION} \${finish} \${ifc.length} \${s.tasks[0]?.totalFloat ?? 0}\`;
}
export function codeOf(e: unknown): CoreErrorCode | null {
  return e instanceof PlannerCoreError ? e.code : null;
}
// @ts-expect-error — een onbekende foutcode hoort niet in CoreErrorCode.
export const wrong: CoreErrorCode = 'NOT_A_CODE';
`);
  writeFileSync(join(consumer, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      noEmit: true, strict: true, module: 'nodenext', moduleResolution: 'nodenext', target: 'es2022',
      types: [], skipLibCheck: false,
    },
    files: ['types-check.ts'],
  }));
  const tsc = run(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', consumer], consumer);
  ok('8 TypeScript-consument typecheckt tegen de declaraties', tsc.status === 0, tsc.out.slice(0, 800));
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (diffs.length === 0) {
  console.log(`OK — kernpakket gebouwd, ingepakt, geïnstalleerd en gebruikt: ${checks} checks groen.`);
} else {
  console.log(`XX kernpakket — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`  - ${d}`);
  process.exit(1);
}
