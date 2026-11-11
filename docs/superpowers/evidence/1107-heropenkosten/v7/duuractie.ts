// Alleen een meting: dezelfde store-aanroepen en duurpatch als paneel en tabel; geen gedeelde check gewijzigd.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TRIAS_FILES, TRIAS_MODEL_FILE, bareBytes, lengthenedTask, openInStore } from '../../../../../tests/planning/ifcAppRoute';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { hourTaskScheduleDuration } from '@/utils/taskDuration';
import type { CellEditIntent } from '@/types/taskGrid';
export { TRIAS_FILES, TRIAS_MODEL_FILE, bareBytes, openInStore };
export type Route = 'paneel' | 'tabel';
export const routes: Route[] = ['paneel', 'tabel'];
export function modelBytes(root: string, rel: string): Uint8Array {
  let raw = readFileSync(join(root, rel), 'latin1');
  if (rel !== TRIAS_MODEL_FILE) {
    // Dezelfde wand als check-ifc-foreign-oude-eigen.ts, niet een andere modelgenerator.
    const wall = [
      "#90001=IFCORGANIZATION($,'Arch',$,$,$);", "#90002=IFCAPPLICATION(#90001,'1','Revit','RVT');",
      "#90003=IFCPERSON($,'Ontwerper',$,$,$,$,$,$);", '#90004=IFCPERSONANDORGANIZATION(#90003,#90001,$);',
      '#90005=IFCOWNERHISTORY(#90004,#90002,$,.ADDED.,$,$,$,1);', "#90006=IFCWALL('2O2Fr$t4X7Zf8NOew3FLOX',#90005,'Wand',$,$,$,$,$,$);",
    ];
    const at = raw.lastIndexOf('ENDSEC;');
    raw = raw.slice(0, at) + wall.join('\n') + '\n' + raw.slice(at);
  }
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
export async function entered(bytes: Uint8Array, route: Route) {
  const { store, snapshot } = await openInStore(bytes);
  const task = lengthenedTask(snapshot(store));
  if (!task) throw new Error('geen taak voor duuractie');
  const before = structuredClone(task.time);
  const calendar = resolveCalendar(task.calendarId, store.getState().calendars, store.getState().calendar);
  const time = { ...task.time };
  const parsed = task.time.durationUnit === 'hours'
    ? { unit: 'hours' as const, durationMinutes: (task.time.durationMinutes ?? 0) + 480, explicitUnit: true }
    : { unit: 'days' as const, scheduleDuration: task.time.scheduleDuration + 1, explicitUnit: true };
  time.durationUnit = parsed.unit;
  if (parsed.unit === 'days') { time.scheduleDuration = parsed.scheduleDuration; time.durationMinutes = undefined; }
  else { time.durationMinutes = parsed.durationMinutes; time.scheduleDuration = hourTaskScheduleDuration(parsed.durationMinutes, calendar); }
  // TaskDurationField.apply -> TaskPropertiesPanel.update, inclusief dezelfde coalesce-sleutel.
  const parts = Object.keys(time).filter(k => time[k as keyof typeof time] !== task.time[k as keyof typeof time]).map(k => `time.${k}`);
  const args = route === 'paneel'
    ? { taskId: task.id, updates: { time }, opts: { coalesceKey: `taskfield:${task.id}:${parts.sort().join(',')}` } }
    : { kind: 'cell-edit' as const, taskId: task.id, columnId: 'task.time.scheduleDuration' as CellEditIntent['columnId'], route: 'task-schedule' as const, value: parsed };
  if (route === 'paneel') store.getState().updateTask(task.id, { time }, { coalesceKey: `taskfield:${task.id}:${parts.sort().join(',')}` });
  else {
    const r = store.getState().runGridMutation([args as CellEditIntent]);
    if (!r.ok) throw new Error(`tabel weigerde de invoer: ${JSON.stringify(r.errors)}`);
  }
  const afterEntry = structuredClone(store.getState().tasks.find(t => t.id === task.id)!.time);
  store.getState().runCPM();
  const domain = snapshot(store);
  return { taskId: task.id, taskName: task.name, before, args, afterEntry,
    afterF5: structuredClone(domain.tasks.find(t => t.id === task.id)!.time), domain };
}
