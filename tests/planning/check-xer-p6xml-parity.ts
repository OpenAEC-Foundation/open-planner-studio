// X9 — P6XML is geen gelijkwaardige XER-archiefadapter. Deze smoke bewaakt de zichtbare asymmetrie.
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { readFileSync } from 'node:fs';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { createDefaultProject } from '@/state/defaults';
import type { Task } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { installDOMParser } from './xmldom-shim';

declare const process: { exit(code: number): never };
installDOMParser();
const failures: string[] = [];
const expect = (label: string, condition: boolean) => { if (!condition) failures.push(label); };
const project = createDefaultProject();
project.id = 'P6XML-X9'; project.name = 'P6XML asymmetrie';
const calendar = createDefaultCalendar(); project.calendarId = calendar.id;
const task = {
  id: 'p6xml-x9-task', name: 'P6 velden', description: '', wbsCode: 'A1',
  taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false, priority: 500,
  parentId: null, childIds: [], resourceIds: [], time: createDefaultTaskTime('2032-02-02', 1),
  p6ProjectId: 'XER-PROJ', p6TaskId: 'XER-TASK', p6DurationType: 'DT_FixedRate',
  p6ActivityType: 'TT_LOE', p6CompletePctType: 'CP_Phys', p6ExpectedFinish: '2032-02-10',
} as Task;
const warnings: string[] = [];
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => warnings.push(args.join(' '));
let xml = '';
try { xml = writeP6XML(project, calendar, [task], [], [], []); } finally { console.warn = originalWarn; }
const roundTripped = readP6XML(xml).tasks.find(candidate => candidate.name === task.name);
expect('1 P6XML schrijft reguliere planningdata', xml.includes('<Activity>') && roundTripped !== undefined);
expect('2 P6XML claimt geen XER/P6-veldpariteit', roundTripped?.p6DurationType === undefined
  && roundTripped?.p6ActivityType === undefined
  && roundTripped?.p6ProjectId === undefined
  && roundTripped?.p6TaskId === undefined);
expect('3 de asymmetrie is als TODO in de writer vastgelegd',
  warnings.length === 0
  && xml.includes('<PlannedDuration>')
  && readFileSync(new URL('../../src/services/p6/p6xmlWriter.ts', import.meta.url), 'utf8').includes('TODO(X9/P6XML)'));
if (failures.length === 0) {
  console.log('OK  xer-p6xml-parity: asymmetrie zichtbaar, geen gelijkwaardigheidsclaim');
  process.exit(0);
}
console.log(`XX  xer-p6xml-parity: ${failures.length} afwijking(en)`);
for (const failure of failures) console.log(`   - ${failure}`);
process.exit(1);
