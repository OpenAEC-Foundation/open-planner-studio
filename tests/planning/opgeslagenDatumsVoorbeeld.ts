import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeIFC, type WriteIFCInput } from '@/services/ifc/ifcWriter';
import { loadStore, openInStore } from './ifcAppRoute';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const enc = new TextEncoder();

const WALL = [
  "#90001=IFCORGANIZATION($,'Arch',$,$,$);", "#90002=IFCAPPLICATION(#90001,'1','Revit','RVT');",
  "#90003=IFCPERSON($,'Ontwerper',$,$,$,$,$,$);", '#90004=IFCPERSONANDORGANIZATION(#90003,#90001,$);',
  '#90005=IFCOWNERHISTORY(#90004,#90002,$,.ADDED.,$,$,$,1);',
  "#90006=IFCWALL('2O2Fr$t4X7Zf8NOew3FLOX',#90005,'Wand',$,$,$,$,$,$);",
].join('\n');

export const withWall = (text: string) => {
  const at = text.lastIndexOf('ENDSEC;');
  return enc.encode(`${text.slice(0, at)}${WALL}\n${text.slice(at)}`);
};

export const PROGRESS_TASK = 'Demolish existing extension';

export interface RecordedExampleOptions {
  edit?: (input: WriteIFCInput) => void;
  wall?: boolean;
  progress?: number;
}

export async function recordedExample({ edit = () => {}, wall = true, progress }: RecordedExampleOptions = {}): Promise<Uint8Array<ArrayBuffer>> {
  const { buildWriteIFCInput } = await loadStore();
  const example = new Uint8Array(readFileSync(join(root, 'public/examples/showcase-verbouwing-eengezinswoning.ifc')));
  const { store } = await openInStore(example, 'voorbeeld.ifc');
  if (progress !== undefined) {
    const task = store.getState().tasks.find(t => t.name === PROGRESS_TASK)!;
    store.getState().setStatusDate(task.time.earlyFinish.slice(0, 10));
    for (const step of progress === 1 ? [0.5, 1] : [progress]) {
      assert(store.getState().setTaskProgress(task.id, step), 'de voortgang is gezet');
      store.getState().runCPM();
    }
    const done = store.getState().tasks.find(t => t.id === task.id)!.time;
    assert(progress < 1 || (done.actualStart && done.actualFinish && done.actualStart < done.actualFinish), 'werkelijke start vóór werkelijk einde');
  }
  const input = structuredClone(buildWriteIFCInput(store.getState(), 'merge'));
  const task = input.tasks.find(t => t.name === 'Set up site')!;
  assert.notEqual(task.time.earlyStart, task.time.scheduleStart, 'de berekening wijkt af van de planstart');
  task.time = { ...task.time, earlyStart: task.time.scheduleStart };
  input.recordedSourceFormat = 'mspdi';
  edit(input);
  return wall ? withWall(writeIFC(input)) : enc.encode(writeIFC(input));
}
