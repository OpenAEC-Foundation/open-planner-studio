import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { createDefaultProject } from '@/state/defaults';
import type { Task } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { installDOMParser } from './xmldom-shim';
import { XER_DURATION_TYPE_TOKEN } from '@/engine/work/workRuleMapping';
import { DEFAULT_WORK_RULE } from '@/types/workRule';

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
expect('2 P6XML claimt geen XER/P6-veldpariteit (behalve DurationType, taaktypes-etappe)',
  roundTripped?.p6DurationType === XER_DURATION_TYPE_TOKEN[DEFAULT_WORK_RULE]
  && roundTripped?.workRule === undefined
  && roundTripped?.p6ActivityType === 'TT_Task'
  && roundTripped?.p6ProjectId !== undefined && roundTripped?.p6ProjectId !== 'XER-PROJ'
  && roundTripped?.p6TaskId !== undefined && roundTripped?.p6TaskId !== 'XER-TASK');
expect('3 P6XML schrijft de geplande duur zonder waarschuwing',
  warnings.length === 0
  && xml.includes('<PlannedDuration>'));
function withDurationType(baseXml: string, label: string | null): string {
  const stripped = baseXml.replace(/\s*<DurationType>[^<]*<\/DurationType>/, '');
  if (label === null) return stripped;
  return stripped.replace(/(<Activity>[\s\S]*?<Type>[^<]*<\/Type>)/, `$1<DurationType>${label}</DurationType>`);
}
function readDurationType(label: string | null): { value: string | undefined; warnings: string[] } {
  const warned: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => warned.push(args.join(' '));
  let value: string | undefined;
  try {
    value = readP6XML(withDurationType(xml, label)).tasks.find(t => t.name === task.name)?.p6DurationType;
  } finally {
    console.warn = original;
  }
  return { value, warnings: warned };
}

const knownDurationTypeLabels: Readonly<Record<string, string>> = {
  'Fixed Duration and Units': 'DT_FixedDUR2',
  'Fixed Duration and Units/Time': 'DT_FixedDrtn',
  'Fixed Units/Time': 'DT_FixedRate',
  'Fixed Units': 'DT_FixedQty',
};
for (const [label, expected] of Object.entries(knownDurationTypeLabels)) {
  const { value, warnings: labelWarnings } = readDurationType(label);
  expect(`4 <DurationType>${label}</DurationType> leest naar ${expected}, geen melding`,
    value === expected && labelWarnings.length === 0);
}

const projectDefaultToken = XER_DURATION_TYPE_TOKEN[DEFAULT_WORK_RULE];
const { value: unknownValue, warnings: unknownWarnings } = readDurationType('Fixed Whatever');
expect('5 onbekend <DurationType>-label erft de projectstandaard en wordt gerapporteerd',
  unknownValue === projectDefaultToken
  && unknownWarnings.length === 1
  && unknownWarnings[0].includes('Fixed Whatever'));

const { value: missingValue, warnings: missingWarnings } = readDurationType(null);
expect('6 ontbrekend <DurationType>-element erft de projectstandaard, geen melding',
  missingValue === projectDefaultToken && missingWarnings.length === 0);

if (failures.length === 0) {
  console.log('OK  xer-p6xml-parity: asymmetrie zichtbaar, geen gelijkwaardigheidsclaim');
  process.exit(0);
}
console.log(`XX  xer-p6xml-parity: ${failures.length} afwijking(en)`);
for (const failure of failures) console.log(`   - ${failure}`);
process.exit(1);
