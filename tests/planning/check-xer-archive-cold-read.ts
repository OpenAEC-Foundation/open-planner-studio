// X9 reviewfix 1: schema-2-opslag is zelfstandig leesbaar in een koud proces. De lage sync-lezer
// is daarbij bewust beschermd: alleen readIFCWithXerReconstruction mag de lazy XER-chunk laden.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const esbuild = join(root, 'node_modules', '.bin', 'esbuild');
const temporary = mkdtempSync(join(tmpdir(), 'ops-xer-cold-read-'));
const writer = join(temporary, 'writer.mjs');
const rawReader = join(temporary, 'reader-raw.mjs');
const asyncReader = join(temporary, 'reader-async.mjs');
const ifc = join(temporary, 'compact.ifc');

let checks = 0;
const failures: string[] = [];
const expect = (label: string, condition: boolean): void => {
  checks += 1;
  if (!condition) failures.push(label);
};

function bundle(source: string, output: string): void {
  execFileSync(esbuild, [
    source, '--log-level=error', '--bundle', '--platform=node', '--format=esm',
    `--alias:@=${join(root, 'src')}`,
    '--define:import.meta.env.DEV=false', '--define:import.meta.env.PROD=true',
    '--define:import.meta.env.MODE="production"', '--define:__OPS_DEV_INSTANCE__="test"',
    `--outfile=${output}`,
  ], { cwd: root, stdio: 'pipe' });
}

function childJson(entry: string): Record<string, unknown> {
  return JSON.parse(execFileSync(process.execPath, [entry, ifc], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  })) as Record<string, unknown>;
}

try {
  bundle('tests/planning/xerArchiveColdReadWriter.ts', writer);
  bundle('tests/planning/xerArchiveColdReadRaw.ts', rawReader);
  bundle('tests/planning/xerArchiveColdReadAsync.ts', asyncReader);
  execFileSync(process.execPath, [writer, ifc], { cwd: root, stdio: 'pipe' });

  const raw = childJson(rawReader);
  const reopened = childJson(asyncReader);
  const ifcText = readFileSync(ifc, 'utf8');

  expect('koud proces A schrijft werkelijk een compacte schema-2-IFC',
    ifcText.includes("IFCPROPERTYSINGLEVALUE('SchemaVersion',$,IFCINTEGER(2),$)"));
  expect('de lage sync-lezer weigert compacte opslag voorspelbaar en verwijst naar de enige async ingang',
    raw.ok === false
    && raw.reason === 'xer-source-archive'
    && typeof raw.message === 'string'
    && raw.message.includes('readIFCWithXerReconstruction'));
  expect('proces B importeert alléén de officiële async ingang en herbouwt de bron zelfstandig',
    reopened.sourceProjectId === 'P-COLD'
    && reopened.taskCount === 1
    && typeof reopened.sha256 === 'string'
    && /^[0-9a-f]{64}$/.test(reopened.sha256));
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

if (failures.length === 0) {
  console.log(`OK  xer-archive-cold-read: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  xer-archive-cold-read: ${failures.length} afwijking(en)`);
for (const failure of failures) console.log(`   - ${failure}`);
process.exit(1);
