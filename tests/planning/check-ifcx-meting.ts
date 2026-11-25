import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC, type WriteIFCInput } from '@/services/ifc/ifcWriter';
import { readIfcx, writeIfcx } from '@/services/ifc/ifcx';
import { serializeIfcx } from '@/services/ifc/ifcx/projection';
import { canonicalFor, ownFileFor } from '@/services/ifc/ifcx/ownFile';
import { selfCheckDifferences } from '@/services/ifc/ifcx/selfCheck';
import { stepRoundtrip } from '@/services/ifc/ifcx/stepRoundtrip';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import { createFileAutoSaveController } from '@/services/actualAutosave/fileAutoSave';
import { loadStore } from './ifcAppRoute';
import { installNodeFileIpc } from './nodeFileIpc';

const MAX_RATIO = 4;
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
    customFieldDefs: [], customTaskTypes: [], libraryPool: undefined, ifcGlobalIds: {}, tasks, sequences,
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
const openAsIfc = (bytes: Uint8Array) => readIFC(new TextDecoder('utf-8', { fatal: true }).decode(bytes));

let failed = 0;
function test(name: string, action: () => void): void {
  try { action(); console.log(`OK ${name}`); }
  catch (error) { failed++; console.error(`XX ${name}: ${String(error instanceof Error ? error.stack ?? error.message : error).slice(0, 1500)}`); }
}

function pieces(size: number): void {
  const input = plan(size);
  const names = [
    'STEP-writer (opslaan als IFC)', 'canonieke planning (STEP-rondgang en laadgrens)', 'eigen bestand (STEP-rondgang, projectie, waardetoets)',
    'serialiseren', 'zelfcontrole met de publieke lezer', 'vergelijking van de zelfcontrole', 'writeIfcx in één stuk',
    'openen als IFC (bytes, STEP-lezer)', 'readIfcx (openen als IFCX)',
  ];
  const relativeTo = [0, 0, 0, 0, 0, 0, 0, 7, 7];
  const wall: number[][] = names.map(() => []), cpu: number[][] = names.map(() => []);
  const before = loadNow();
  for (let round = 0; round < ROUNDS; round++) {
    const stepText = timed(() => writeIFC(input));
    const canonical = timed(() => canonicalFor(input));
    const own = timed(() => ownFileFor(canonical.value, CLOCK));
    const ifcxText = timed(() => serializeIfcx(own.value.document));
    const reread = timed(() => readIfcx(encode(ifcxText.value)));
    const compare = timed(() => selfCheckDifferences(canonical.value, reread.value));
    assert.deepEqual(compare.value, []);
    const whole = timed(() => writeIfcx(input, CLOCK));
    const stepBytes = encode(stepText.value);
    const ifcxBytes = encode(whole.value);
    const openStep = timed(() => openAsIfc(stepBytes));
    const open = timed(() => readIfcx(ifcxBytes));
    [stepText, canonical, own, ifcxText, reread, compare, whole, openStep, open].forEach((part, index) => { wall[index].push(part.wall); cpu[index].push(part.cpu); });
  }
  console.log(`   ${size} taken, mediaan van ${ROUNDS}, belasting ${before} → ${loadNow()}`);
  names.forEach((name, index) => {
    const ratio = median(cpu[index]) / median(cpu[relativeTo[index]]);
    console.log(`   | ${size} | ${name} | ${median(wall[index]).toFixed(0)} | ${median(cpu[index]).toFixed(0)} | ${ratio.toFixed(2)} |`);
  });
}

function ratioTest(name: string, label: string, prepare: () => { step: () => unknown; ifcx: () => unknown }, stepName: string, ifcxName: string): void {
  test(name, () => {
    const { step: stepAction, ifcx: ifcxAction } = prepare();
    stepAction();
    ifcxAction();
    const step: number[] = [], ifcx: number[] = [];
    const before = loadNow();
    for (let round = 0; round < ROUNDS; round++) {
      if (round % 2 === 0) {
        step.push(timed(stepAction).cpu);
        ifcx.push(timed(ifcxAction).cpu);
      } else {
        ifcx.push(timed(ifcxAction).cpu);
        step.push(timed(stepAction).cpu);
      }
    }
    const ratio = median(ifcx) / median(step);
    console.log(`   CPU-tijd in ms, mediaan van ${ROUNDS}, volgorde om en om: ${stepName} ${median(step).toFixed(0)}, ${ifcxName} ${median(ifcx).toFixed(0)}; belasting ${before} → ${loadNow()}`);
    console.log(`IFCX-verhouding ${label}: ${ratio.toFixed(2)} (grens ${MAX_RATIO})`);
    assert.ok(ratio <= MAX_RATIO, `${ifcxName} kost ${ratio.toFixed(2)} keer ${stepName}`);
  });
}

ratioTest(`opslaan als IFCX kost bij ${SIZE} taken hoogstens ${MAX_RATIO} keer opslaan als IFC`, 'opslaan', () => {
  const input = plan(SIZE);
  assert.equal(stepRoundtrip(input).tasks.length, SIZE);
  return { step: () => writeIFC(input), ifcx: () => writeIfcx(input, CLOCK) };
}, 'opslaan als IFC', 'opslaan als IFCX');

ratioTest(`openen als IFCX kost bij ${SIZE} taken hoogstens ${MAX_RATIO} keer openen als IFC`, 'openen', () => {
  const input = plan(SIZE);
  const stepBytes = encode(writeIFC(input));
  const ifcxBytes = encode(writeIfcx(input, CLOCK));
  assert.equal(readIfcx(ifcxBytes).tasks.length, SIZE);
  return { step: () => openAsIfc(stepBytes), ifcx: () => readIfcx(ifcxBytes) };
}, 'openen als IFC', 'openen als IFCX');

async function timedAsync(action: () => Promise<unknown>): Promise<number> {
  const cpu0 = process.cpuUsage();
  await action();
  const cpu = process.cpuUsage(cpu0);
  return (cpu.user + cpu.system) / 1000;
}

type AppFormat = 'ifc' | 'ifcx';
async function appRatioTest(
  name: string, label: string, edit: (format: AppFormat, at: number) => void, save: (format: AppFormat) => Promise<void>,
): Promise<void> {
  try {
    const round = async (format: AppFormat, at: number) => { edit(format, at); return timedAsync(() => save(format)); };
    await round('ifc', -1);
    await round('ifcx', -1);
    const step: number[] = [], ifcx: number[] = [];
    const before = loadNow();
    for (let at = 0; at < ROUNDS; at++) {
      if (at % 2 === 0) {
        step.push(await round('ifc', at));
        ifcx.push(await round('ifcx', at));
      } else {
        ifcx.push(await round('ifcx', at));
        step.push(await round('ifc', at));
      }
    }
    const ratio = median(ifcx) / median(step);
    console.log(`   CPU-tijd in ms, mediaan van ${ROUNDS}, volgorde om en om: IFC-document ${median(step).toFixed(0)}, IFCX-document ${median(ifcx).toFixed(0)}; belasting ${before} → ${loadNow()}`);
    console.log(`IFCX-verhouding ${label}: ${ratio.toFixed(2)} (grens ${MAX_RATIO})`);
    assert.ok(ratio <= MAX_RATIO, `${label} van een IFCX-document kost ${ratio.toFixed(2)} keer die van een IFC-document`);
    console.log(`OK ${name}`);
  } catch (error) {
    failed++;
    console.error(`XX ${name}: ${String(error instanceof Error ? error.stack ?? error.message : error).slice(0, 1500)}`);
  }
}

{
  const { createAppStoreContext } = await loadStore();
  const appData = mkdtempSync(join(tmpdir(), 'ops-ifcx-meting-'));
  const ipc = installNodeFileIpc({ appDataDir: appData });
  try {
    const input = plan(SIZE);
    const files = { ifc: encode(writeIFC(input)), ifcx: encode(writeIfcx(input, CLOCK)) };
    const stores = {} as Record<'ifc' | 'ifcx', ReturnType<typeof createAppStoreContext>['store']>;
    for (const format of ['ifc', 'ifcx'] as const) {
      const path = join(appData, `meting.${format}`);
      writeFileSync(path, files[format]);
      const { store } = createAppStoreContext();
      store.setState(s => { s.ui.featureFlags = { ifcx: true }; });
      const opened = format === 'ifcx' ? { content: '', bytes: files[format] } : { content: new TextDecoder().decode(files[format]) };
      await store.getState().openOpenedFile({ name: `meting.${format}`, ...opened, ref: { kind: 'path', path } });
      assert.equal(store.getState().filePath, path, `het ${format}-document is geopend`);
      assert.equal(store.getState().tasks.length, SIZE);
      store.setState(s => { s.autoSaveToFile = true; });
      stores[format] = store;
    }
    const leafOf = (format: 'ifc' | 'ifcx') => stores[format].getState().tasks.find(t => t.childIds.length === 0)!.id;
    const edit = (route: string) => (format: AppFormat, at: number) =>
      stores[format].getState().updateTask(leafOf(format), { name: `${route} ${at}` });
    await appRatioTest(`Ctrl+S van een IFCX-document kost bij ${SIZE} taken hoogstens ${MAX_RATIO} keer die van een IFC-document`,
      'Ctrl+S', edit('ctrl-s'), async (format) => {
        const saved = await stores[format].getState().saveFileForDocument(stores[format].getState().activeDocumentId);
        assert.equal(saved, true, `Ctrl+S van het ${format}-document`);
      });
    await appRatioTest(`een ronde Automatisch opslaan van een IFCX-document kost bij ${SIZE} taken hoogstens ${MAX_RATIO} keer die van een IFC-document`,
      'Automatisch opslaan', edit('automatisch'), async (format) => {
        await createFileAutoSaveController({ getState: stores[format].getState, enabled: () => true }).flush();
        assert.equal(stores[format].getState().isDirty, false, `Automatisch opslaan van het ${format}-document`);
      });
    for (const format of ['ifc', 'ifcx'] as const) {
      const errors = stores[format].getState().ui.notifications.filter(n => n.severity === 'error').map(n => n.messageKey);
      assert.deepEqual(errors, [], `geen meldingen bij het ${format}-document`);
    }
  } finally { ipc.dispose(); }
}

if (process.env.OPS_IFCX_MEASURE === '1') {
  console.log('   | taken | stuk | wandklok (ms) | CPU-tijd (ms) | verhouding tot opslaan of openen als IFC |');
  console.log('   |---|---|---|---|---|');
  for (const size of [1000, 5000, 10000]) pieces(size);
}

console.log(`IFCX-meting: ${failed ? 'ROOD' : 'GROEN'}`);
if (failed) process.exitCode = 1;
