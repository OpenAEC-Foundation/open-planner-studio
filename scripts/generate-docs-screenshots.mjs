#!/usr/bin/env node
// Screenshots voor de tutorials-extensie (ontwerp gebruikersdocumentatie §7 en §11), build-time uit de
// echte app:
//
//   npm run gen:docs-screenshots -- --out <map>                 # alle tutorials, nl en en
//   npm run gen:docs-screenshots -- --out <map> --only tut-3-kalender,tut-4-uren
//
// Draait `tests/browser/tutorial-steps.spec.ts` via de bestaande browsertest-infrastructuur
// (`run-browser-tests.mjs`: eigen poort, bewaakte Vite-server, Playwright Chromium) met vastleggen aan.
// Die spec volgt per tutorial het stapscript in `tests/browser/tutorials/` met echte UI-events vanaf de
// standen van `gen:tutorial-project`, controleert na elke stap de toestand en schrijft de uitsneden als
// WebP (alleen licht thema). Pas als ALLES groen is, vervangt dit script `<map>/img/<taal>/tut-*.webp`
// (bij `--only` alleen de beelden van die tutorials); een rode stap laat de map ongemoeid.
//
// `<map>` is de map van de extensie (`extensions/tutorials` in open-planner-studio-extensions); de
// tutorialtekst verwijst naar `img/{lang}/<naam>.webp`.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const LANGS = ['nl', 'en'];
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

function arg(name) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(name);
  if (i >= 0) return argv[i + 1];
  const eq = argv.find(a => a.startsWith(`${name}=`));
  return eq ? eq.slice(name.length + 1) : undefined;
}

const outArg = arg('--out');
if (!outArg || outArg.startsWith('--')) {
  console.error('gebruik: npm run gen:docs-screenshots -- --out <map> [--only <tutorial-id,…>]');
  process.exit(2);
}
const out = resolve(process.cwd(), outArg);
const only = arg('--only');
const ids = only ? only.split(',').filter(Boolean) : null;

const shots = mkdtempSync(join(tmpdir(), 'ops-docs-screenshots-'));
const run = spawnSync(process.execPath, [join(root, 'scripts', 'run-browser-tests.mjs'), 'tests/browser/tutorial-steps.spec.ts', '--reporter=line'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    OPS_DOCS_SCREENSHOTS_OUT: shots,
    ...(ids ? { OPS_TUTORIAL_ONLY: ids.join(',') } : {}),
  },
});
if (run.status !== 0) {
  rmSync(shots, { recursive: true, force: true });
  console.error(`\n✗ niet alle stappen slaagden (exit ${run.status ?? 'signaal'}): ${out} is ongemoeid gelaten`);
  process.exit(run.status || 1);
}

// Een beeld heet `tut-<n>-…`; het tutorial-id begint met `tut-<n>-`. Bij --only alleen die vervangen.
const prefixes = ids?.map(id => id.match(/^tut-\d+-/)?.[0]).filter(Boolean) ?? null;
const ours = name => /^tut-\d+-.*\.webp$/.test(name) && (!prefixes || prefixes.some(p => name.startsWith(p)));

let count = 0;
let bytes = 0;
for (const lang of LANGS) {
  const from = join(shots, lang);
  const to = join(out, 'img', lang);
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(to)) if (ours(name)) rmSync(join(to, name));
  if (!existsSync(from)) continue;
  for (const name of readdirSync(from).sort()) {
    copyFileSync(join(from, name), join(to, name));
    count++;
    bytes += statSync(join(to, name)).size;
  }
}
rmSync(shots, { recursive: true, force: true });
console.log(`\n✓ ${count} beelden (${LANGS.join(', ')}) → ${join(out, 'img')} (${(bytes / 1024).toFixed(0)} kB)`);
