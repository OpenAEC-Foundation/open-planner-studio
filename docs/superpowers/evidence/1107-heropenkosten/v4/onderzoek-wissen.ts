// Alleen meten: echte Delete, gewone opslag zonder model en beide heropenroutes; geen productfix.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDeterminism } from '../../../../../tests/planning/ifcPariteitKern';
import { loadStore, openInStore } from '../../../../../tests/planning/ifcAppRoute';
import { cloneDomain, openForeign, tryMerge } from '../../../../../tests/planning/ifcMergeKern';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { generatedModel } from '../../../../../tests/planning/ifcGeneratedModel';
import { scanStep } from '@/services/ifc/foreign/stepScanner';

installDeterminism();
const { createAppStoreContext, buildWriteIFCInput } = await loadStore();
const normalize = (x: unknown): unknown => Array.isArray(x) ? x.map(normalize) : x && typeof x === 'object'
  ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => [k, normalize(v)])) : x;
const equal = (a: unknown, b: unknown) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
async function plain(text: string) {
  const { store } = createAppStoreContext();
  assert(!store.getState().ui.featureFlags.ifcForeignContent, 'de gewone open-route heeft de flag uit');
  await store.getState().openOpenedFile({ name: 'zonder-model.ifc', content: text, bytes: new TextEncoder().encode(text), ref: null });
  assert(store.getState().tasks.length > 0);
  return { store, snapshot: () => buildWriteIFCInput(store.getState()) };
}
const cases = JSON.parse(readFileSync('docs/superpowers/evidence/1107-heropenkosten/v3/nieuwe-weigeringen.json', 'utf8')) as {bestand:string;bewerking:string}[];
for (const c of cases.filter(c => c.bewerking.endsWith(' wissen'))) {
  const file = c.bestand.startsWith('h7-') ? 'tests/planning/fixtures/h7-tijden-oude-writer.ifc' : 'tests/planning/fixtures/urenperdag-oude-writer.ifc';
  const text = readFileSync(file, 'utf8');
  const target = c.bewerking.replace(/ wissen$/, '');
  const original = await plain(text);
  const before = structuredClone(original.snapshot());
  const task = before.tasks.find(t => t.id === target)!; assert(task);
  const cal = before.resourceCalendars!.find(c => c.id === task.calendarId)!; assert(cal);
  const users = {
    tasks: before.tasks.filter(t => t.calendarId === cal.id).map(t => t.id),
    resources: before.resources.filter(r => r.calendarId === cal.id).map(r => r.id),
    assignments: before.assignments.filter(a => a.taskId === target || before.resources.some(r => r.id === a.resourceId && r.calendarId === cal.id)),
  };
  // De storeactie van de echte Delete-route, niet de handgeschreven filter uit plannerEdits.
  original.store.getState().deleteTasksBulk([target]);
  const after = structuredClone(original.snapshot());
  const written = writeIFC(after);
  const reopened = await plain(written);
  const back = reopened.snapshot();
  const beforeIds = before.resourceCalendars!.map(c => c.id), afterIds = after.resourceCalendars!.map(c => c.id), backIds = back.resourceCalendars!.map(c => c.id);
  const missing = afterIds.filter(id => !backIds.includes(id)), added = backIds.filter(id => !afterIds.includes(id));
  const changed = after.resourceCalendars!.filter(cal => !equal(cal, back.resourceCalendars!.find(c => c.id === cal.id))).map(c => c.id);
  const writtenIndex = scanStep(new TextEncoder().encode(written));
  const writtenCalCount = Array.from({length:writtenIndex.count}, (_,i)=>i).filter(i => writtenIndex.type(i)==='IFCWORKCALENDAR').length;
  const modelBytes = generatedModel(process.cwd(), text, 0);
  const model = await openInStore(modelBytes);
  model.store.getState().deleteTasksBulk([target]);
  const md = model.snapshot(model.store);
  const merge = await tryMerge(cloneDomain(md), md.ifcSource!);
  console.log(JSON.stringify({ file, task:target, calendar:cal, users, beforeIds, afterDeleteIds:afterIds, afterReopenIds:backIds,
    calendarStillAfterDelete:afterIds.includes(cal.id), calendarStillAfterReopen:backIds.includes(cal.id),
    missing, added, changed, sameOrder:equal(afterIds,backIds), writtenCalCount,
    modelAfterDeleteIds:md.resourceCalendars?.map(c=>c.id), merge:merge.ok ? {ok:true, rereadIds:(await openForeign(merge.bytes)).resourceCalendars?.map(c=>c.id)} : {ok:false,cases:merge.error.cases} }));
  // Stopvoorwaarde voor deze proef: geen verdere gevallen behandelen als er echt een kalender ontbreekt/verandert.
  if (missing.length || added.length || changed.length) { console.log('STOP: gewone opslag verandert de kalenderinhoud'); process.exitCode=2; break; }
}
