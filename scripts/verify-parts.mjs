#!/usr/bin/env node
// De `verify`-poort, verdeeld over parallelle CI-jobs.
//
// De stappen komen RECHTSTREEKS uit package.json: `npm run verify` wordt op `&&` gesplitst en
// `npm test` uitgeklapt tot zijn eigen stappen. Dit script deelt ze alleen in. Een stap die hier
// niet expliciet is ingedeeld, valt in STATIC — een nieuwe stap in `verify` kan dus nooit buiten CI
// vallen, en er is geen tweede lijst die kan achterlopen (de reden dat ci.yml tot nu toe bewust één
// commando draaide). release.yml draait `npm run verify` nog in één keer; live.yml draait geen verify
// meer maar deployt pas na een geslaagde ci.yml-run.
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

/**
 * De matrixrecords uit ci.yml: elk `- part: …` begint een record; `shard:` (en de andere sleutels) horen
 * bij het record zolang ze dieper ingesprongen staan dan dat streepje. Zo hoort een shard altijd bij zijn
 * eigen `part` (review PR #399: een losse regex over `shard:`-regels zag niet dat een record met `4/4`
 * naar een ander deel was verhuisd). Een `shard:` buiten een record is ook een record, met part `null`.
 */
export function matrixRecords(yaml) {
  const records = [];
  let current = null;
  for (const line of yaml.split('\n')) {
    const start = /^(\s*)-\s*part:\s*['"]?([\w-]+)['"]?\s*$/.exec(line);
    if (start) {
      current = { indent: start[1].length, part: start[2], shard: null };
      records.push(current);
      continue;
    }
    const indent = /^(\s*)/.exec(line)[1].length;
    if (current && line.trim() !== '' && indent <= current.indent) current = null;
    const shard = /^\s*shard:\s*['"]?([^'"\s]+)['"]?\s*$/.exec(line);
    if (shard) {
      if (current) current.shard = shard[1];
      else records.push({ indent, part: null, shard: shard[1] });
    }
  }
  return records;
}

/** Problemen met de browsershards: alleen browserrecords hebben een shard, en samen zijn ze 1/n … n/n. */
export function shardProblemsOf(records) {
  const problems = [];
  for (const r of records) {
    if (r.shard && r.part !== 'browser') problems.push(`shard ${r.shard} hoort bij ${r.part ? `deel "${r.part}"` : 'geen matrixrecord'}, niet bij browser`);
  }
  const browser = records.filter(r => r.part === 'browser');
  const sharded = browser.filter(r => r.shard);
  if (sharded.length === 0) {
    if (browser.length > 1) problems.push(`${browser.length} browserrecords zonder shard draaien elk de hele suite`);
    return problems;
  }
  if (sharded.length !== browser.length) problems.push('een browserrecord zonder shard naast gesharde browserrecords');
  const parsed = sharded.map(r => /^(\d+)\/(\d+)$/.exec(r.shard));
  if (parsed.some(m => !m)) {
    problems.push(`ongeldige shard(s): ${sharded.filter((_, i) => !parsed[i]).map(r => r.shard).join(', ')}`);
    return problems;
  }
  const totals = [...new Set(parsed.map(m => Number(m[2])))];
  if (totals.length !== 1) {
    problems.push(`verschillende totalen (${totals.join(', ')})`);
  } else {
    const ks = parsed.map(m => Number(m[1])).sort((a, b) => a - b).join(',');
    if (ks !== Array.from({ length: totals[0] }, (_, i) => i + 1).join(',')) {
      problems.push(`browsershards ${sharded.map(r => r.shard).join(', ')} zijn niet precies 1/${totals[0]} … ${totals[0]}/${totals[0]}`);
    }
  }
  return problems;
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
    const records = matrixRecords(yaml);
    const inCi = new Set(records.map(r => r.part));
    const missing = Object.keys(parts).filter(p => !inCi.has(p));
    const extra = [...inCi].filter(p => !(p in parts));
    const shardProblems = shardProblemsOf(records);
    if (missing.length || extra.length || shardProblems.length) {
      if (missing.length) console.log(`XX  ci.yml draait deel/delen niet: ${missing.join(', ')} — voeg een matrixregel \`part: <naam>\` toe`);
      if (extra.length) console.log(`XX  ci.yml noemt onbekende delen: ${extra.join(', ')} (zie --list)`);
      for (const problem of shardProblems) console.log(`XX  ci.yml browsershards: ${problem}`);
      return 1;
    }
    const browserShards = records.filter(r => r.part === 'browser' && r.shard).length;
    console.log(`OK  verify-parts: ci.yml draait alle ${Object.keys(parts).length} delen (${Object.keys(parts).join(', ')})`
      + `${browserShards ? `, browser in ${browserShards} shards` : ''}`);
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
