import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC, type WriteIFCInput } from '@/services/ifc/ifcWriter';
import { readIfcx, writeIfcx } from '@/services/ifc/ifcx';
import { buildIfcxDocument, serializeIfcx } from '@/services/ifc/ifcx/ifcxWriter';
import { readIfcxText } from '@/services/ifc/ifcx/ifcxReader';
import { selfCheckDifferences } from '@/services/ifc/ifcx/selfCheck';
import { stepRoundtrip } from '@/services/ifc/ifcx/stepRoundtrip';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';

const MAX_RATIO = 4;
const MAX_CPU_MS = 4000;
const SIZE = 10000;
const ROUNDS = 5;
const CLOCK = new Date('2027-01-01T00:00:00.000Z');
const NOT_IN_KERN_PROJECT_FIELDS = [
  'progressMode', 'schedulingOptions', 'schedulingProfile', 'defaultWorkRule', 'companyId', 'companyName', 'p6ProjectCode',
  'dependentProjectsFolder', 'anchorsFromOpenDocuments',
];

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const base = readIFC(readFileSync(join(root, 'public/examples/03-kantoorgebouw-zuidas.ifc'), 'utf8'));

function task(id: string, start: string, finish: string): Task {
  return {
    id, name: `Taak ${id}`, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false,
    priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: {
      durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: 1, scheduleStart: start, scheduleFinish: finish,
      earlyStart: start, earlyFinish: finish, lateStart: start, lateFinish: finish, freeFloat: 0, totalFloat: 0, isCritical: true, completion: 0,
    },
  };
}

function plan(size: number): WriteIFCInput {
  const tasks: Task[] = [];
  const sequences: Sequence[] = [];
  let summary: Task | undefined;
  for (let i = 0; i < size; i++) {
    const date = new Date(Date.UTC(2027, 0, 4 + Math.floor(i / 25) * 7 + (i % 25) % 5)).toISOString().slice(0, 10);
    if (i % 25 === 0) {
      summary = { ...task(`groep-${i}`, `${date}T07:00`, `${date}T16:00`), wbsCode: String(i / 25 + 1) };
      tasks.push(summary);
      continue;
    }
    const leaf = { ...task(`taak-${i}`, `${date}T07:00`, `${date}T16:00`), parentId: summary!.id };
    tasks.push(leaf);
    summary!.childIds.push(leaf.id);
    if (i % 25 > 1) sequences.push({ id: `rel-${i}`, predecessorId: `taak-${i - 1}`, successorId: leaf.id, type: 'FINISH_START', lagDays: 0 });
  }
  const project = { ...base.project } as Record<string, unknown>;
  for (const key of NOT_IN_KERN_PROJECT_FIELDS) delete project[key];
  return {
    ...base, project: project as unknown as WriteIFCInput['project'], resources: [], assignments: [], baselines: [], activityCodeTypes: [],
    customFieldDefs: [], customTaskTypes: [], ifcLiteralCalendarIds: undefined, libraryPool: undefined, ifcGlobalIds: {}, tasks, sequences,
  };
}

function timed<T>(action: () => T): { value: T; wall: number; cpu: number } {
  const wall0 = performance.now();
  const cpu0 = process.cpuUsage();
  const value = action();
  const cpu = process.cpuUsage(cpu0);
  return { value, wall: performance.now() - wall0, cpu: (cpu.user + cpu.system) / 1000 };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

const loadNow = () => { try { return readFileSync('/proc/loadavg', 'utf8').split(' ').slice(0, 3).join(' '); } catch { return 'onbekend'; } };
const encode = (text: string) => new TextEncoder().encode(text);

let failed = 0;
function test(name: string, action: () => void): void {
  try { action(); console.log(`OK ${name}`); }
  catch (error) { failed++; console.error(`XX ${name}: ${String(error instanceof Error ? error.stack ?? error.message : error).slice(0, 1500)}`); }
}

function pieces(size: number): void {
  const input = plan(size);
  const names = [
    'STEP-writer (opslaan als IFC)', 'STEP-lezer', 'IFCX-writer zonder rondgang en zelfcontrole', 'IFCX teruglezen',
    'vergelijking van de zelfcontrole', 'writeIfcx in één stuk', 'readIfcx (openen)',
  ];
  const wall: number[][] = names.map(() => []), cpu: number[][] = names.map(() => []);
  const before = loadNow();
  for (let round = 0; round < ROUNDS; round++) {
    const stepText = timed(() => writeIFC(input));
    const stepRead = timed(() => readIFC(stepText.value, {}, { projectTimestampFallback: input.project }));
    const ifcxText = timed(() => serializeIfcx(buildIfcxDocument(stepRead.value, CLOCK)));
    const reread = timed(() => readIfcxText(ifcxText.value, false));
    const compare = timed(() => selfCheckDifferences(stepRead.value, reread.value));
    assert.deepEqual(compare.value, []);
    const whole = timed(() => writeIfcx(input, CLOCK));
    const open = timed(() => readIfcx(encode(whole.value)));
    [stepText, stepRead, ifcxText, reread, compare, whole, open].forEach((part, index) => { wall[index].push(part.wall); cpu[index].push(part.cpu); });
  }
  const save = median(cpu[0]);
  console.log(`   ${size} taken, mediaan van ${ROUNDS}, belasting ${before} → ${loadNow()}`);
  names.forEach((name, index) => {
    console.log(`   | ${size} | ${name} | ${median(wall[index]).toFixed(0)} | ${median(cpu[index]).toFixed(0)} | ${(median(cpu[index]) / save).toFixed(2)} |`);
  });
}

test(`opslaan als IFCX kost bij ${SIZE} taken hoogstens ${MAX_RATIO} keer opslaan als IFC en hoogstens ${MAX_CPU_MS} ms CPU-tijd`, () => {
  const input = plan(SIZE);
  assert.equal(stepRoundtrip(input).tasks.length, SIZE);
  writeIFC(input);
  writeIfcx(input, CLOCK);
  const step: number[] = [], ifcx: number[] = [];
  const before = loadNow();
  for (let round = 0; round < ROUNDS; round++) {
    step.push(timed(() => writeIFC(input)).cpu);
    ifcx.push(timed(() => writeIfcx(input, CLOCK)).cpu);
  }
  const ratio = median(ifcx) / median(step);
  console.log(`   CPU-tijd in ms, mediaan van ${ROUNDS}: opslaan als IFC ${median(step).toFixed(0)}, writeIfcx ${median(ifcx).toFixed(0)}, verhouding ${ratio.toFixed(2)}; belasting ${before} → ${loadNow()}`);
  assert.ok(ratio <= MAX_RATIO, `writeIfcx kost ${ratio.toFixed(2)} keer opslaan als IFC`);
  assert.ok(median(ifcx) <= MAX_CPU_MS, `writeIfcx kost ${median(ifcx).toFixed(0)} ms CPU-tijd`);
});

if (process.env.OPS_IFCX_MEASURE === '1') {
  console.log('   | taken | stuk | wandklok (ms) | CPU-tijd (ms) | verhouding tot opslaan als IFC |');
  console.log('   |---|---|---|---|---|');
  for (const size of [1000, 5000, 10000]) pieces(size);
}

console.log(`IFCX-meting: ${failed ? 'ROOD' : 'GROEN'}`);
if (failed) process.exitCode = 1;
