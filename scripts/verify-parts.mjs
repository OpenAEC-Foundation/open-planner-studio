#!/usr/bin/env node
// De `verify`-poort, verdeeld over parallelle CI-jobs.
//
// De stappen komen RECHTSTREEKS uit package.json: `npm run verify` wordt op `&&` gesplitst en
// `npm test` uitgeklapt tot zijn eigen stappen. Dit script deelt ze alleen in. Een stap die hier
// niet expliciet is ingedeeld, valt in STATIC — een nieuwe stap in `verify` kan dus nooit buiten CI
// vallen, en er is geen tweede lijst die kan achterlopen (de reden dat ci.yml tot nu toe bewust één
// commando draaide). release.yml en live.yml draaien `npm run verify` nog steeds in één keer.
//
//   node scripts/verify-parts.mjs --list            # alle delen met hun stappen
//   node scripts/verify-parts.mjs <deel> [-- args]  # draai één deel; args gaan naar de laatste stap
//   node scripts/verify-parts.mjs --check-ci <ci.yml>  # elk deel staat in de CI-matrix, niets extra
//
// Exit 0 = alle stappen van het deel groen, anders de exitcode van de eerste rode stap (zelfde
// semantiek als de `&&`-keten van `verify`).
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATIC = 'static';

/** Expliciete indeling; al het andere valt in STATIC. */
const ASSIGN = {
  'test:planning': 'planning',
  'test:browser': 'browser',
  'test:library': 'suites',
  'test:mcp': 'suites',
  'test:dev-server': 'suites',
};

/** `npm run a && npm test && …` → ['a', 'test', …]; faalt hard op een vorm die we niet kennen. */
function chainSteps(scripts, name) {
  const cmd = scripts[name];
  if (typeof cmd !== 'string') throw new Error(`package.json mist het script "${name}"`);
  return cmd.split('&&').map((raw) => {
    const part = raw.trim();
    if (part === 'npm test') return 'test';
    const m = part.match(/^npm run ([\w:.-]+)$/);
    if (!m) {
      throw new Error(`"${name}" bevat een stap die dit script niet kan indelen: "${part}" — `
        + 'alleen `npm run <script>` en `npm test` worden ondersteund');
    }
    return m[1];
  });
}

/** Alle bladstappen van `verify`, in volgorde, met `test` uitgeklapt. */
export function verifySteps(scripts) {
  return chainSteps(scripts, 'verify').flatMap(step => (step === 'test' ? chainSteps(scripts, 'test') : [step]));
}

/** { deel: [stappen] } in de volgorde van `verify`. */
export function partition(scripts) {
  const parts = {};
  for (const step of verifySteps(scripts)) {
    const part = ASSIGN[step] ?? STATIC;
    (parts[part] ??= []).push(step);
  }
  return parts;
}

function readScripts() {
  return JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts;
}

function main(argv) {
  const scripts = readScripts();
  const parts = partition(scripts);

  if (argv[0] === '--list') {
    for (const [part, steps] of Object.entries(parts)) console.log(`${part}: ${steps.join(', ')}`);
    return 0;
  }

  if (argv[0] === '--check-ci') {
    const file = argv[1] ?? join(ROOT, '.github/workflows/ci.yml');
    const yaml = readFileSync(file, 'utf8');
    const inCi = new Set([...yaml.matchAll(/^\s*-?\s*part:\s*['"]?([\w-]+)['"]?\s*$/gm)].map(m => m[1]));
    const missing = Object.keys(parts).filter(p => !inCi.has(p));
    const extra = [...inCi].filter(p => !(p in parts));
    if (missing.length || extra.length) {
      if (missing.length) console.log(`XX  ci.yml draait deel/delen niet: ${missing.join(', ')} — voeg een matrixregel \`part: <naam>\` toe`);
      if (extra.length) console.log(`XX  ci.yml noemt onbekende delen: ${extra.join(', ')} (zie --list)`);
      return 1;
    }
    console.log(`OK  verify-parts: ci.yml draait alle ${Object.keys(parts).length} delen (${Object.keys(parts).join(', ')})`);
    return 0;
  }

  const dash = argv.indexOf('--');
  const part = argv[0];
  const extra = dash >= 0 ? argv.slice(dash + 1) : [];
  if (!part || !(part in parts)) {
    console.error(`Onbekend deel "${part ?? ''}". Bekend: ${Object.keys(parts).join(', ')} (zie --list)`);
    return 2;
  }
  const steps = parts[part];
  for (const [i, step] of steps.entries()) {
    const args = ['run', step, ...(i === steps.length - 1 && extra.length ? ['--', ...extra] : [])];
    console.log(`\n── verify-parts [${part}] npm ${args.join(' ')} ──`);
    const res = spawnSync('npm', args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
    if (res.status !== 0) return res.status ?? 1;
  }
  return 0;
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (err) {
    console.log(`XX  verify-parts: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
