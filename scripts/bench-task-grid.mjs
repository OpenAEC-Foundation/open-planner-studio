#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { dirname, resolve } from 'node:path';
import { build } from 'esbuild';

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function round(value) {
  return Math.round(value * 1_000) / 1_000;
}

function buildHash() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

async function loadHarness() {
  const entry = resolve('tests/planning/taskGridPerformanceHarness.ts');
  const bundled = await build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    alias: { '@': resolve('src') },
    define: {
      'import.meta.env.DEV': 'false',
      'import.meta.env.PROD': 'true',
      'import.meta.env.MODE': '"production"',
      __OPS_DEV_INSTANCE__: '"benchmark"',
    },
  });
  const source = bundled.outputFiles[0]?.text;
  if (!source) throw new Error('esbuild leverde geen performanceharnas op');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

function comparisons(current, previous) {
  const compared = {};
  let regressionOver25Percent = false;
  for (const [name, currentMs] of Object.entries(current)) {
    const previousMs = previous?.[name];
    const deltaPercent = typeof previousMs === 'number' && previousMs > 0
      ? ((currentMs - previousMs) / previousMs) * 100
      : null;
    const regressed = deltaPercent !== null && deltaPercent > 25;
    regressionOver25Percent ||= regressed;
    compared[name] = {
      previousMs: typeof previousMs === 'number' ? round(previousMs) : null,
      currentMs: round(currentMs),
      deltaPercent: deltaPercent === null ? null : round(deltaPercent),
      regressed,
    };
  }
  return { timings: compared, regressionOver25Percent };
}

const outputPath = resolve(argumentValue('--out') ?? 'task-grid-benchmark.json');
const comparePath = argumentValue('--compare');
const harness = await loadHarness();
const fixture = harness.createTaskGridPerformanceFixture();
const benchmark = harness.runTaskGridPerformanceBenchmark(fixture);
const cpuList = cpus();
const mediansMs = Object.fromEntries(
  Object.entries(benchmark.mediansMs).map(([name, value]) => [name, round(value)]),
);
const samplesMs = Object.fromEntries(
  Object.entries(benchmark.samplesMs).map(([name, values]) => [name, values.map(round)]),
);
const comparison = comparePath
  ? comparisons(mediansMs, JSON.parse(await readFile(resolve(comparePath), 'utf8')).mediansMs)
  : null;
const withinBudgets = {
  mountedRows: benchmark.mountedRows <= Math.ceil(benchmark.counts.viewportHeight / benchmark.counts.rowHeight) + 16,
  mountedDataCells: benchmark.mountedDataCells <= benchmark.mountedRows * benchmark.counts.columnCount,
  relationIndex: mediansMs.relationIndex <= benchmark.budgetsMs.relationIndexMs,
  navigationCommands: mediansMs.navigationCommands <= benchmark.budgetsMs.commandBatchMs,
  selectionCommands: mediansMs.selectionCommands <= benchmark.budgetsMs.commandBatchMs,
  virtualWindow: mediansMs.virtualWindow <= benchmark.budgetsMs.virtualWindowMs,
};
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpuModel: cpuList[0]?.model ?? 'unknown',
    logicalCpuCount: cpuList.length,
    buildHash: buildHash(),
  },
  counts: benchmark.counts,
  protocol: { warmups: benchmark.warmups, runs: benchmark.runs, statistic: 'median' },
  budgetsMs: benchmark.budgetsMs,
  mediansMs,
  samplesMs,
  mountedRows: benchmark.mountedRows,
  mountedDataCells: benchmark.mountedDataCells,
  withinBudgets,
  comparison,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(outputPath);
console.log(JSON.stringify({ mediansMs, withinBudgets, comparison }, null, 2));

if (Object.values(withinBudgets).some(value => !value)) process.exitCode = 1;
if (comparison?.regressionOver25Percent) process.exitCode = 2;
