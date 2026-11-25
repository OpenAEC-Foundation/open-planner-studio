import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDeterminism } from './ifcPariteitKern';
import { openInStore, loadStore } from './ifcAppRoute';
import { IfcParseError } from '@/services/ifc/ifcErrors';
import { MergeNeedsPhase2Error } from '@/services/ifc/foreign/mergeWriter';
import { hasForeignContent } from '@/services/ifc/foreign/ifcSource';

installDeterminism();
await loadStore();
const { foreignChangesIfSaved } = await import('@/state/foreignLinksNotice');
const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
const { prepareIfcOutput } = await import('@/state/prepareIfcOutput');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FOREIGN = join(ROOT, 'tests/fixtures/ifc-foreign');
const DIRS = [
  FOREIGN, join(FOREIGN, 'council'), join(ROOT, 'tests/planning/fixtures/oude-tags'),
  join(ROOT, 'tests/planning/fixtures'), join(ROOT, 'public/examples'),
];
const files = DIRS.flatMap(dir => readdirSync(dir).filter(f => f.endsWith('.ifc')).map(f => join(dir, f))).sort();
const REFUSED_AT_OPEN = new Set(['model-ifc2x3.ifc']);
const REVIT_WALL = [
  "#90001=IFCORGANIZATION($,'Arch',$,$,$);", "#90002=IFCAPPLICATION(#90001,'1','Revit','RVT');",
  "#90003=IFCPERSON($,'Ontwerper',$,$,$,$,$,$);", '#90004=IFCPERSONANDORGANIZATION(#90003,#90001,$);',
  '#90005=IFCOWNERHISTORY(#90004,#90002,$,.ADDED.,$,$,$,1);', "#90006=IFCWALL('2O2Fr$t4X7Zf8NOew3FLOX',#90005,'Wand',$,$,$,$,$,$);",
];
const latin1 = (bytes: Uint8Array) => { let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192)); return s; };
const withWall = (bytes: Uint8Array): Uint8Array => {
  const src = latin1(bytes), at = src.lastIndexOf('ENDSEC;');
  return Uint8Array.from(`${src.slice(0, at)}${REVIT_WALL.map(l => `${l}\n`).join('')}${src.slice(at)}`, c => c.charCodeAt(0));
};

type Store = Awaited<ReturnType<typeof openInStore>>['store'];
const linkedTargets = (store: Store): Set<number> => {
  const references = store.getState().ifcSource?.foreignReferences;
  return new Set(references ? references.targets : []);
};
const stepIdOf = (store: Store, kind: string, id: string) => store.getState().ifcSource?.stepIds[`${kind}:${id}`];

function deleteOne(store: Store): string {
  const s = store.getState(), targets = linkedTargets(store);
  const linked = <T extends { id: string }>(kind: string, objects: readonly T[]) =>
    objects.find(o => { const step = stepIdOf(store, kind, o.id); return step !== undefined && targets.has(step); });
  const task = linked('task', s.tasks.filter(t => t.childIds.length === 0));
  if (task) { s.deleteTask(task.id); return `gekoppelde taak ${task.name}`; }
  const resource = linked('res', s.resources);
  if (resource) { s.removeResource(resource.id); return `gekoppelde resource ${resource.name}`; }
  const sequence = linked('seq', s.sequences);
  if (sequence) { s.removeSequence(sequence.id); return 'gekoppelde relatie'; }
  const leaf = s.tasks.find(t => t.childIds.length === 0);
  if (leaf) { s.deleteTask(leaf.id); return `taak ${leaf.name}`; }
  return 'niets';
}

const rows: string[] = [];
const mismatches: string[] = [];
let compared = 0, nonEmpty = 0, refusedByMerge = 0, refusedAtOpen = 0;
for (const path of files) {
  const name = path.slice(ROOT.length + 1);
  let bytes: Uint8Array = new Uint8Array(readFileSync(path));
  let store: Store;
  try {
    store = (await openInStore(bytes, path.split('/').pop())).store;
    if (!hasForeignContent(store.getState().ifcSource)) {
      bytes = withWall(bytes);
      store = (await openInStore(bytes, path.split('/').pop())).store;
    }
  } catch (error) {
    if (error instanceof IfcParseError && REFUSED_AT_OPEN.has(path.split('/').pop()!)) { refusedAtOpen++; continue; }
    throw error;
  }
  const deleted = deleteOne(store);
  const before = foreignChangesIfSaved(store.getState());
  let written: number;
  try {
    const write = await prepareIfcOutput(store.getState(), buildWriteIFCInput(store.getState(), 'merge'));
    written = write.prepared?.foreignChanges?.length ?? 0;
  } catch (error) {
    if (error instanceof MergeNeedsPhase2Error) { refusedByMerge++; rows.push(`${name}: ${deleted}: vooraf ${before}, de merge weigert`); continue; }
    throw error;
  }
  compared++;
  if (written > 0) nonEmpty++;
  rows.push(`${name}: ${deleted}: vooraf ${before}, merge ${written}`);
  if (before !== written) mismatches.push(`${name} (${deleted}): vooraf ${before}, merge ${written}`);
}

for (const row of rows) console.log(`   ${row}`);
console.log(`Telling vooraf: ${compared} bestanden vergeleken, ${nonEmpty} met een niet-lege lijst, ${refusedByMerge} geweigerd door de merge, ${refusedAtOpen} geweigerd bij openen.`);
try {
  assert.deepEqual(mismatches, [], 'de telfunctie vooraf geeft hetzelfde aantal als de merge');
  assert(nonEmpty >= 5, `te weinig bestanden met een niet-lege lijst (${nonEmpty})`);
  console.log('OK telling vooraf gelijk aan prepared.foreignChanges');
} catch (error) {
  console.error(`XX ${(error as Error).message}`);
  process.exitCode = 1;
}
