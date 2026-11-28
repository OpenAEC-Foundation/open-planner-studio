#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATIC = 'static';

const ASSIGN = {
  'test:planning': 'planning',
  'test:browser': 'browser',
  'test:library': 'suites',
  'test:mcp': 'suites',
  'test:dev-server': 'suites',
};

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

export function verifySteps(scripts) {
  return chainSteps(scripts, 'verify').flatMap(step => (step === 'test' ? chainSteps(scripts, 'test') : [step]));
}

export function partition(scripts) {
  const parts = {};
  for (const step of verifySteps(scripts)) {
    const part = ASSIGN[step] ?? STATIC;
    (parts[part] ??= []).push(step);
  }
  return parts;
}

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

const SHARDED_PARTS = ['browser', 'planning'];

export function shardProblemsOf(records) {
  const problems = [];
  for (const r of records) {
    if (r.shard && !SHARDED_PARTS.includes(r.part)) {
      problems.push(`shard ${r.shard} hoort bij ${r.part ? `deel "${r.part}"` : 'geen matrixrecord'}, niet bij browsershards of planningshards`);
    }
  }
  for (const part of SHARDED_PARTS) problems.push(...partShardProblems(records, part));
  return problems;
}

function partShardProblems(records, part) {
  const problems = [];
  const all = records.filter(r => r.part === part);
  const sharded = all.filter(r => r.shard);
  if (sharded.length === 0) {
    if (all.length > 1) problems.push(`${all.length} ${part}records zonder shard draaien elk de hele suite`);
    return problems;
  }
  if (sharded.length !== all.length) problems.push(`een ${part}record zonder shard naast gesharde ${part}records`);
  const parsed = sharded.map(r => /^(\d+)\/(\d+)$/.exec(r.shard));
  if (parsed.some(m => !m)) {
    problems.push(`ongeldige ${part}shard(s): ${sharded.filter((_, i) => !parsed[i]).map(r => r.shard).join(', ')}`);
    return problems;
  }
  const totals = [...new Set(parsed.map(m => Number(m[2])))];
  if (totals.length !== 1) {
    problems.push(`verschillende totalen bij ${part}shards (${totals.join(', ')})`);
  } else {
    const ks = parsed.map(m => Number(m[1])).sort((a, b) => a - b).join(',');
    if (ks !== Array.from({ length: totals[0] }, (_, i) => i + 1).join(',')) {
      problems.push(`${part}shards ${sharded.map(r => r.shard).join(', ')} zijn niet precies 1/${totals[0]} … ${totals[0]}/${totals[0]}`);
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
      for (const problem of shardProblems) console.log(`XX  ci.yml: ${problem}`);
      return 1;
    }
    const shardText = SHARDED_PARTS
      .map(part => [part, records.filter(r => r.part === part && r.shard).length])
      .filter(([, count]) => count > 0)
      .map(([part, count]) => `, ${part} in ${count} shards`)
      .join('');
    console.log(`OK  verify-parts: ci.yml draait alle ${Object.keys(parts).length} delen (${Object.keys(parts).join(', ')})${shardText}`);
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
