#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assignShards } from './browser-shards.mjs';

const BASE_ZONE = '-';
const SEP = '\x1f';
const DEFAULT_JOBS = 4;

export function parsePlan(text) {
  const plan = { esbuild: [], zones: [], items: [] };
  for (const line of text.split('\n')) {
    if (!line) continue;
    const [kind, ...f] = line.split('\t');
    if (kind === 'esbuild') plan.esbuild = f;
    else if (kind === 'zones') plan.zones = f;
    else if (kind === 'check') {
      const [id, src, out, matrix, env, argv] = f;
      plan.items.push({ id, src, out, matrix: matrix === '1', env: splitField(env), argv: splitField(argv), cmd: false });
    } else if (kind === 'cmd') {
      const [id, env, argv] = f;
      plan.items.push({ id, src: '', out: '', matrix: false, env: splitField(env), argv: splitField(argv), cmd: true });
    } else {
      throw new Error(`onbekende planregel: ${line}`);
    }
  }
  return plan;
}

const splitField = (field) => (field ? field.split(SEP) : []);

export const runsAlone = (item) => item.env.includes('OPS_RELAX_PERF=0');

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function expectedLines(plan) {
  return [
    '# Elke controle van de volledige planningssuite: `matrix` draait ook in elke zone, `los` alleen gewoon.',
    '# Ontbreekt er een, of staat er een te veel, dan is de run rood. Nieuwe check of bewuste wijziging:',
    '# bash tests/planning/run.sh --list-checks > tests/planning/expected-checks.txt',
    `zones ${plan.zones.join(' ')}`,
    ...[...plan.items].sort(byId).map(item => `${item.id} ${item.matrix ? 'matrix' : 'los'}`),
  ];
}

export function parseExpected(text) {
  const expected = { zones: [], kinds: new Map() };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [first, ...rest] = line.split(/\s+/);
    if (first === 'zones') expected.zones = rest;
    else if (rest.length === 1 && (rest[0] === 'matrix' || rest[0] === 'los')) expected.kinds.set(first, rest[0]);
    else throw new Error(`onleesbare regel in de verwachte lijst: ${raw}`);
  }
  return expected;
}

export function expectedRuns(expected) {
  const runs = [];
  for (const [id, kind] of expected.kinds) {
    runs.push(`${id}\t${BASE_ZONE}`);
    if (kind === 'matrix') for (const zone of expected.zones) runs.push(`${id}\t${zone}`);
  }
  return runs;
}

export function planProblems(plan, expected) {
  const problems = [];
  if (plan.zones.join(' ') !== expected.zones.join(' ')) {
    problems.push(`zones: de lijst zegt "${expected.zones.join(' ')}", run.sh zegt "${plan.zones.join(' ')}"`);
  }
  const seenIds = new Set();
  const seenOuts = new Set();
  for (const item of plan.items) {
    if (seenIds.has(item.id)) problems.push(`${item.id} staat twee keer in het plan`);
    seenIds.add(item.id);
    if (item.out && seenOuts.has(item.out)) problems.push(`twee checks schrijven naar hetzelfde uitvoerpad: ${basename(item.out)}`);
    if (item.out) seenOuts.add(item.out);
    const kind = expected.kinds.get(item.id);
    if (!kind) problems.push(`${item.id} staat niet in de verwachte lijst (nieuwe check? zie onderaan)`);
    else if (kind !== (item.matrix ? 'matrix' : 'los')) {
      problems.push(`${item.id}: de lijst zegt "${kind}", run.sh zegt "${item.matrix ? 'matrix' : 'los'}"`);
    }
  }
  for (const id of expected.kinds.keys()) {
    if (!seenIds.has(id)) problems.push(`${id} staat in de verwachte lijst maar draait niet meer`);
  }
  return problems;
}

export function itemsOfShard(items, k, n, durations = {}) {
  const ids = new Set(assignShards(items.map(item => item.id), durations, n)[k - 1].files);
  return items.filter(item => ids.has(item.id)).sort(byId);
}

export function shardWeights(items, durations) {
  const weights = { ...durations };
  for (const item of items) {
    if (runsAlone(item) && typeof durations[item.id] === 'number') weights[item.id] = durations[item.id] * DEFAULT_JOBS;
  }
  return weights;
}

export function longestFirst(runs, durations, zoneCount) {
  const estimate = (run) => (durations[run.item.id] ?? 1) / (run.item.matrix ? 1 + zoneCount : 1);
  return runs.map((run, i) => ({ run, i })).sort((a, b) => estimate(b.run) - estimate(a.run) || a.i - b.i).map(x => x.run);
}

export function durationsFromManifests(manifests) {
  const totals = new Map();
  for (const manifest of manifests) {
    for (const line of manifest.split('\n')) {
      if (!line) continue;
      const [id, , , ms] = line.split('\t');
      totals.set(id, (totals.get(id) ?? 0) + Number(ms));
    }
  }
  const sorted = [...totals.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(sorted.map(([id, ms]) => [id, Math.max(1, Math.round(ms / 1000))]));
}

export function parseShard(value) {
  const m = /^(\d+)\/(\d+)$/.exec(value);
  const k = m ? Number(m[1]) : 0;
  const n = m ? Number(m[2]) : 0;
  if (!m || k < 1 || k > n) throw new Error(`ongeldige shard "${value}": verwacht k/n met 1 <= k <= n`);
  return [k, n];
}

export function countProblems(expected, manifests) {
  const want = new Set(expectedRuns(expected));
  const seen = new Map();
  const red = [];
  for (const manifest of manifests) {
    for (const line of manifest.split('\n')) {
      if (!line) continue;
      const [id, zone, code] = line.split('\t');
      const key = `${id}\t${zone}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
      if (code !== '0') red.push(`${id} (${zone}): exit ${code}`);
    }
  }
  const show = (key) => key.replaceAll('\t', ' in zone ');
  const problems = [...red];
  for (const key of want) {
    const count = seen.get(key) ?? 0;
    if (count === 0) problems.push(`niet gedraaid: ${show(key)}`);
    if (count > 1) problems.push(`${count} keer gedraaid: ${show(key)}`);
  }
  for (const key of seen.keys()) if (!want.has(key)) problems.push(`niet verwacht maar wel gedraaid: ${show(key)}`);
  return { problems, expected: want.size, ran: [...seen.values()].reduce((a, b) => a + b, 0) };
}

function runProcess(program, args, { cwd, env, logPath }) {
  return new Promise((resolve) => {
    const fd = openSync(logPath, 'a');
    const child = spawn(program, args, { cwd, env, stdio: ['ignore', fd, fd] });
    let done = false;
    const finish = (code, note) => {
      if (done) return;
      done = true;
      closeSync(fd);
      if (note) appendFileSync(logPath, `${note}\n`);
      resolve(code);
    };
    child.on('error', (err) => finish(127, `XX  proces startte niet: ${err.message}`));
    child.on('close', (code, signal) => finish(code ?? 1, signal ? `XX  proces gestopt door ${signal}` : ''));
  });
}

function bundleItems(items, esbuildArgs, root, logs) {
  const failed = new Map();
  const todo = items.filter(item => item.src);
  if (todo.length === 0) return failed;
  const esbuild = join(root, 'node_modules/.bin/esbuild');
  const outDir = dirname(todo[0].out);
  const entries = todo.map(item => `${basename(item.out, '.mjs')}=${item.src}`);
  const together = spawnSync(esbuild, [...entries, ...esbuildArgs, `--outdir=${outDir}`, '--out-extension:.js=.mjs'],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (together.status === 0) return failed;
  for (const [i, item] of todo.entries()) {
    const single = spawnSync(esbuild, [item.src, ...esbuildArgs, `--outfile=${item.out}`],
      { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (single.status !== 0) {
      const log = join(logs, `bundel-${i}.log`);
      writeFileSync(log, `${single.stderr ?? ''}${single.stdout ?? ''}${single.error ? `${single.error.message}\n` : ''}`);
      failed.set(item.id, log);
    }
  }
  return failed;
}

async function runPool(runs, jobs, start, onDone) {
  let next = 0;
  const worker = async () => {
    while (next < runs.length) {
      const run = runs[next++];
      await start(run);
      onDone(run);
    }
  };
  await Promise.all(Array.from({ length: Math.min(jobs, runs.length) }, worker));
}

const label = (run) => (run.zone === BASE_ZONE ? run.item.id : `${run.item.id} [TZ ${run.zone}]`);

async function commandRun(argv) {
  const [planPath, expectedPath, ...options] = argv;
  const opt = (name) => options.find(o => o.startsWith(`--${name}=`))?.slice(name.length + 3);
  const [k, n] = opt('shard') ? parseShard(opt('shard')) : [1, 1];
  const plan = parsePlan(readFileSync(planPath, 'utf8'));
  const expected = parseExpected(readFileSync(expectedPath, 'utf8'));
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const requested = Number(process.env.OPS_PLANNING_JOBS);
  const jobs = Number.isInteger(requested) && requested > 0 ? requested : Math.min(DEFAULT_JOBS, availableParallelism());

  let status = 0;
  const problems = planProblems(plan, expected);
  for (const problem of problems) console.log(`XX  verwachte checks: ${problem}`);
  if (problems.length > 0) {
    status = 1;
    console.log('    Nieuwe check of bewuste wijziging? Werk de lijst bij met:');
    console.log('    bash tests/planning/run.sh --list-checks > tests/planning/expected-checks.txt');
  } else {
    console.log(`OK  verwachte checks: plan klopt met de lijst (${expectedRuns(expected).length} runs over ${plan.items.length} checks)`);
  }

  const durations = JSON.parse(readFileSync(join(dirname(expectedPath), 'check-durations.json'), 'utf8'));
  const items = itemsOfShard(plan.items, k, n, shardWeights(plan.items, durations));
  const order = new Map(plan.items.map((item, i) => [item.id, i]));
  items.sort((a, b) => order.get(a.id) - order.get(b.id));
  const shardText = n > 1 ? ` (deel ${k}/${n})` : '';
  console.log(`── Planningssuite: ${items.length} checks${shardText}, hoogstens ${jobs} processen tegelijk ──`);

  const work = mkdtempSync(join(tmpdir(), 'ops-planning-'));
  const logs = join(work, 'logs');
  mkdirSync(logs);
  const started = Date.now();
  const failedBundles = bundleItems(items, plan.esbuild, root, logs);
  console.log(`    gebundeld in ${((Date.now() - started) / 1000).toFixed(1)} s`);

  const runnable = [];
  for (const item of items) {
    const failed = failedBundles.get(item.id);
    if (failed) {
      process.stdout.write(readFileSync(failed, 'utf8'));
      console.log(`XX  bundelen mislukt: ${basename(item.src)} — zie de esbuild-fout hierboven`);
      status = 1;
    } else {
      runnable.push(item);
    }
  }

  const makeRun = (item, zone) => ({ item, zone, index: 0, log: '', code: null, ms: 0 });
  const baseRuns = runnable.map(item => makeRun(item, BASE_ZONE));
  const zoneRuns = plan.zones.flatMap(zone => runnable.filter(item => item.matrix).map(item => makeRun(item, zone)));
  const parallel = longestFirst([...baseRuns.filter(run => !runsAlone(run.item)), ...zoneRuns], durations, plan.zones.length);
  const alone = baseRuns.filter(run => runsAlone(run.item));
  [...parallel, ...alone].forEach((run, i) => { run.index = i; });

  const active = new Set();
  const start = async (run) => {
    const dir = join(work, 'tmp', String(run.index));
    mkdirSync(dir, { recursive: true });
    run.log = join(logs, `${run.index}.log`);
    const env = { NODE_COMPILE_CACHE: join(work, 'compile-cache'), ...process.env, TMPDIR: dir, TMP: dir, TEMP: dir };
    if (run.zone !== BASE_ZONE) env.TZ = run.zone;
    for (const pair of run.item.env) {
      const at = pair.indexOf('=');
      env[pair.slice(0, at)] = pair.slice(at + 1);
    }
    const [program, args] = run.item.cmd ? [run.item.argv[0], run.item.argv.slice(1)] : [process.execPath, run.item.argv];
    const t0 = Date.now();
    active.add(run);
    run.code = await runProcess(program, args, { cwd: process.cwd(), env, logPath: run.log });
    active.delete(run);
    run.ms = Date.now() - t0;
    rmSync(dir, { recursive: true, force: true });
  };

  const printQueue = [...baseRuns];
  const flush = () => {
    while (printQueue.length > 0 && printQueue[0].code !== null) {
      const run = printQueue.shift();
      process.stdout.write(readFileSync(run.log, 'utf8'));
      if (run.code !== 0) console.log(`XX  ${run.item.id}: exit ${run.code} — de uitvoer hierboven is van deze check`);
    }
  };
  const heartbeat = setInterval(() => {
    const names = [...active].map(label);
    console.log(`    nog bezig na ${Math.round((Date.now() - started) / 1000)} s: ${names.join(', ')}`);
  }, 60_000);

  await runPool(parallel, jobs, start, flush);
  await runPool(alone, 1, start, flush);
  clearInterval(heartbeat);

  const allRuns = [...baseRuns, ...zoneRuns];
  const manifest = allRuns.map(run => `${run.item.id}\t${run.zone}\t${run.code}\t${run.ms}\n`).join('');
  const manifestPath = opt('manifest');
  if (manifestPath) writeFileSync(manifestPath, manifest);

  if (allRuns.some(run => run.code !== 0)) status = 1;
  for (const zone of plan.zones) {
    const red = zoneRuns.filter(run => run.zone === zone && run.code !== 0);
    if (red.length === 0) {
      console.log(`TZ ${zone}: groen`);
      continue;
    }
    console.log(`TZ ${zone}: ROOD — ${red.length} check(s), de eigen uitvoer volgt`);
    for (const run of red) {
      console.log(`--- ${label(run)}: exit ${run.code} ---`);
      process.stdout.write(readFileSync(run.log, 'utf8'));
    }
  }

  if (n === 1) {
    const { problems: gaps, expected: want, ran } = countProblems(expected, [manifest]);
    const missing = gaps.filter(gap => !/: exit /.test(gap));
    for (const gap of missing) console.log(`XX  telling: ${gap}`);
    if (missing.length > 0) status = 1;
    console.log(`${missing.length === 0 ? 'OK ' : 'XX '} telling: ${ran} runs gedraaid, ${want} verwacht`);
  } else {
    console.log(`OK  deel ${k}/${n}: ${allRuns.length} runs gedraaid; de telling over alle delen volgt in de job test`);
  }

  const slowest = [...allRuns].sort((a, b) => b.ms - a.ms).slice(0, 8);
  console.log(`    klaar in ${((Date.now() - started) / 1000).toFixed(1)} s; traagste runs: `
    + slowest.map(run => `${label(run)} ${(run.ms / 1000).toFixed(1)} s`).join(', '));
  rmSync(work, { recursive: true, force: true });
  return status;
}

function commandCount(argv) {
  const [expectedPath, ...manifestPaths] = argv;
  const expected = parseExpected(readFileSync(expectedPath, 'utf8'));
  const { problems, expected: want, ran } = countProblems(expected, manifestPaths.map(p => readFileSync(p, 'utf8')));
  for (const problem of problems) console.log(`XX  telling: ${problem}`);
  console.log(`${problems.length === 0 ? 'OK ' : 'XX '} telling: ${ran} runs gedraaid in ${manifestPaths.length} delen, ${want} verwacht`);
  return problems.length === 0 ? 0 : 1;
}

async function main(argv) {
  const [command, ...rest] = argv;
  if (command === 'run') return commandRun(rest);
  if (command === 'count') return commandCount(rest);
  if (command === 'durations') {
    const durations = durationsFromManifests(rest.map(p => readFileSync(p, 'utf8')));
    console.log(JSON.stringify(durations, null, 0).replaceAll(',"', ',\n"'));
    return 0;
  }
  if (command === 'list') {
    console.log(expectedLines(parsePlan(readFileSync(rest[0], 'utf8'))).join('\n'));
    return 0;
  }
  console.error('Gebruik: planning-pool.mjs run|list|count (zie bovenaan dit bestand)');
  return 2;
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (err) => {
    console.log(`XX  planning-pool: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
}
