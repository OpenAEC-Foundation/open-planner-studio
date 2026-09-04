// F3-contract: adapters mogen een OPS-customclassificatie nooit stil als CONSTRUCTION teruggeven.
// IFC blijft de bron van waarheid; CSV/MSPDI/P6 gebruiken elk hun eigen vrije uitbreidingsveld.
import { createDefaultProject } from '@/state/slices/projectSlice';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { writeCSV } from '@/services/csv/csvWriter';
import { readCSV } from '@/services/csv/csvReader';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import type { Task } from '@/types/task';
import { installDOMParser } from './xmldom-shim';

installDOMParser();

const errors: string[] = [];
const eq = (label: string, actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) errors.push(`${label}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
};
const project = createDefaultProject();
const calendar = createDefaultCalendar();
const custom = { id: 'ops-gevel-v1', name: 'Gevelinspectie' };
const task: Task = {
  id: 'task-gevel', name: 'Controle', description: '', wbsCode: '1', taskType: 'USERDEFINED', customTaskTypeId: custom.id,
  status: 'NOT_STARTED', isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
  time: createDefaultTaskTime(project.startDate, 1),
};

const csv = writeCSV(project, calendar, [task], [], [], [], [custom]);
const mspdi = writeMSPDI(project, calendar, [task], [], [], [], [], [], null, [custom]);
const p6 = writeP6XML(project, calendar, [task], [], [], [], [], [custom]);

for (const [format, parsed] of [
  ['CSV', readCSV(csv)],
  ['MSPDI', readMSPDI(mspdi)],
  ['P6', readP6XML(p6)],
  ['IFC', readIFC(writeIFC({ project, calendar, tasks: [task], sequences: [], resources: [], assignments: [], customTaskTypes: [custom] }))],
] as const) {
  eq(`${format}: taaktype`, parsed.tasks[0]?.taskType, 'USERDEFINED');
  eq(`${format}: stabiele id`, parsed.tasks[0]?.customTaskTypeId, custom.id);
  eq(`${format}: catalogus`, parsed.customTaskTypes, [custom]);
}

// Integratieregressie T1 × F3: P6 en IFC bewaren beide onafhankelijke contracten tegelijk.
// De taaktype-UDF/-property mag de expliciete uur-eenheid niet overschrijven (of omgekeerd).
const hourTask: Task = {
  ...task,
  id: 'task-gevel-uur',
  name: 'Uurcontrole',
  time: {
    ...task.time,
    durationUnit: 'hours',
    durationMinutes: 90,
    scheduleDuration: 90 / (calendar.hoursPerDay * 60),
    scheduleStart: `${project.startDate}T08:00`,
    scheduleFinish: `${project.startDate}T09:30`,
    earlyStart: `${project.startDate}T08:00`,
    earlyFinish: `${project.startDate}T09:30`,
    lateStart: `${project.startDate}T08:00`,
    lateFinish: `${project.startDate}T09:30`,
  },
};
const p6Combined = readP6XML(writeP6XML(project, calendar, [hourTask], [], [], [], [], [custom]));
const ifcCombined = readIFC(writeIFC({
  project, calendar, tasks: [hourTask], sequences: [], resources: [], assignments: [], customTaskTypes: [custom],
}));
for (const [format, parsed] of [['P6', p6Combined], ['IFC', ifcCombined]] as const) {
  eq(`${format}: combinatie taaktype`, parsed.tasks[0]?.customTaskTypeId, custom.id);
  eq(`${format}: combinatie catalogus`, parsed.customTaskTypes, [custom]);
  eq(`${format}: combinatie uur-eenheid`, parsed.tasks[0]?.time.durationUnit, 'hours');
  eq(`${format}: combinatie minuten`, parsed.tasks[0]?.time.durationMinutes, 90);
}

// Een vreemd CSV-type zonder OPS-id blijft projectlokaal USERDEFINED en wordt nooit een builtin.
const foreign = readCSV('Name;Task Type\nExterne classificatie;Vendor activity\n');
eq('vreemde CSV-classificatie', foreign.tasks[0]?.taskType, 'USERDEFINED');
eq('vreemde CSV-catalogusnaam', foreign.customTaskTypes?.[0]?.name, 'Vendor activity');

// De adapteruitbreidingen blijven identificeerbaar en schema-eerlijk: MSPDI gebruikt zijn vrije
// ExtendedAttribute; P6 gebruikt top-level UDFType/UDFValue met ForeignObjectId, nooit een
// verzonnen genest Activity-kind.
eq('MSPDI marker', mspdi.includes('OpenPlannerStudio.CustomTaskType.v1'), true);
eq('P6 top-level UDF-koppeling', p6.includes('<ForeignObjectId>1</ForeignObjectId>'), true);
eq('P6 UDF staat niet in Activity', /<Activity>([\s\S]*?)<\/Activity>/.exec(p6)?.[1].includes('<UDFValue>'), false);
eq('P6 gebruikt het officiële Text-veld', p6.includes('<Text>{&quot;ops&quot;:'), true);
eq('P6 verzint geen los UDFValue-ObjectId', /<UDFValue>\s*<ObjectId>/.test(p6), false);

// Beschadigde catalogus: de stabiele taak-id blijft behouden, terwijl de naam eerlijk ontbreekt.
const orphanCsv = readCSV('Name;Task Type;OPS Custom Task Type ID\nZonder naam;USERDEFINED;ops-orphan\n');
eq('CSV orphan-id blijft op taak', orphanCsv.tasks[0]?.customTaskTypeId, 'ops-orphan');
eq('CSV orphan maakt geen naam', orphanCsv.customTaskTypes, []);
const orphanIfc = readIFC(writeIFC({ project, calendar, tasks: [{ ...task, customTaskTypeId: 'ops-orphan' }], sequences: [], resources: [], assignments: [], customTaskTypes: [] }));
eq('IFC orphan-id blijft op taak', orphanIfc.tasks[0]?.customTaskTypeId, 'ops-orphan');
eq('IFC orphan maakt geen naam', orphanIfc.customTaskTypes, []);

// Een vreemd JSON-object in een ander vrij veld mag niet toevallig OPS-data worden.
const hostileMspdi = mspdi.replace('OpenPlannerStudio.CustomTaskType.v1', 'AnderProduct.Type.v1');
eq('MSPDI vreemde marker genegeerd', readMSPDI(hostileMspdi).tasks[0]?.customTaskTypeId, undefined);
const hostileP6 = p6.replace('<Title>OPS Custom Task Type</Title>', '<Title>Vendor JSON</Title>');
eq('P6 vreemde UDF-definitie genegeerd', readP6XML(hostileP6).tasks[0]?.customTaskTypeId, undefined);

if (errors.length) {
  for (const error of errors) console.error(`XX ${error}`);
  process.exitCode = 1;
} else console.log('OK custom task types: IFC + CSV/MSPDI/P6 id+naam round-trip en foreign fallback');
