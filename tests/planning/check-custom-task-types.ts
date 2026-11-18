// F3-contract: adapters mogen een OPS-customclassificatie nooit stil als CONSTRUCTION teruggeven.
// IFC blijft de bron van waarheid; CSV/MSPDI/P6 gebruiken elk hun eigen vrije uitbreidingsveld.
// Daarna (#804 keuze 7, knownbug 1748) de store-actie `renameProjectTaskType`: de projectkopie van een
// eigen taaktype hernoemen is één ongedaan-maakstap, maakt het document gewijzigd en gaat mee in het IFC.
// Fixronde 1 van #999: alleen een werksoort die een taak gebruikt (anders bewaart IFC/herstel de naam niet),
// alleen in het document waarin de vraag gesteld is, en de bevestigde naam overleeft IFC én crashherstel.
// Eigenaarsbesluit 18 november 2026 (#804 keuze 7, knownbug 1829): een projectkopie die geen taak gebruikt,
// krijgt de nieuwe naam stil (`renameUnusedProjectTaskType`): geen vraag, geen ongedaan-maakstap, niet gewijzigd.
import './domStub';
import { useAppStore } from '@/state/appStore';
import { createAppStoreContext } from '@/state/appStoreFactory';
import { serializeRecoverySnapshot } from '@/services/recovery/recoverySnapshotInput';
import { readRecoveryDocument } from '@/state/readRecoveryDocument';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
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
import { applyProjectTaskTypeRename } from '@/components/task-sections/projectTaskTypeRename';

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
// ExtendedAttribute; P6 definieert de UDF top-level (<UDFType>) en zet de WAARDE in de activiteit
// (`<UDF><TypeObjectId/><TextValue/></UDF>`, Oracle-schema UDFAssignmentType), zoals echte P6 XML
// (sinds 2026-10; oudere exports met top-level <UDFValue> leest de reader nog).
eq('MSPDI marker', mspdi.includes('OpenPlannerStudio.CustomTaskType.v1'), true);
const p6Activity = /<Activity>([\s\S]*?)<\/Activity>/.exec(p6)?.[1] ?? '';
eq('P6 UDF-waarde staat in de Activity', /<UDF>\s*<TypeObjectId>900000001<\/TypeObjectId>\s*<TextValue>\{&quot;ops&quot;:/.test(p6Activity), true);
eq('P6 UDF-definitie top-level', /<UDFType>[\s\S]*?<Title>OPS Custom Task Type<\/Title>[\s\S]*?<\/UDFType>/.test(p6), true);
eq('P6 schrijft geen losse UDFValue meer', p6.includes('<UDFValue>'), false);

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

// ── Projectkopie hernoemen (#804 keuze 7): één store-actie, undo/redo, gewijzigd document, IFC ──
const S = () => useAppStore.getState();
S().newProject();
S().ensureProjectTaskType({ id: 'ctt-gevel', name: 'Gevelinspectie' });
S().ensureProjectTaskType({ id: 'ctt-dak', name: 'Dakinspectie' });
const storeTask = S().addTask({ name: 'Gevel bekijken' });
S().updateTask(storeTask, { taskType: 'USERDEFINED', customTaskTypeId: 'ctt-gevel' });
useAppStore.setState({ isDirty: false }); // zoals na opslaan
const projectNames = () => S().customTaskTypes.map(type => `${type.id}=${type.name}`);
const before = projectNames();
eq('hernoemen: begin niet gewijzigd', S().isDirty, false);
eq('hernoemen: uitslag', S().renameProjectTaskType(S().activeDocumentId, 'ctt-gevel', '  Gevelcontrole  '), { status: 'renamed' });
eq('hernoemen: nieuwe naam in het project', projectNames(), ['ctt-gevel=Gevelcontrole', 'ctt-dak=Dakinspectie']);
eq('hernoemen: document gewijzigd', S().isDirty, true);
S().undo();
eq('hernoemen: ongedaan maken zet de oude naam terug', projectNames(), before);
S().redo();
eq('hernoemen: opnieuw zet de nieuwe naam terug', projectNames(), ['ctt-gevel=Gevelcontrole', 'ctt-dak=Dakinspectie']);

const reopened = readIFC(writeIFC(buildWriteIFCInput(S(), 'planOnly')));
eq('hernoemen: na opslaan en heropenen staat de nieuwe naam in het IFC', reopened.customTaskTypes, [{ id: 'ctt-gevel', name: 'Gevelcontrole' }]);

// Een botsende naam (ander type in dit project, ook met andere hoofdletters), een lege naam, een
// onbekend type, dezelfde naam, een werksoort die geen taak gebruikt of een ander document veranderen
// niets en maken geen ongedaan-maakstap.
const applied = () => S().historyEvents.filter(event => event.state === 'applied').length;
const stepsBefore = applied();
const namesBefore = projectNames();
eq('botsing: uitslag noemt het andere type', S().renameProjectTaskType(S().activeDocumentId, 'ctt-gevel', 'dakinspectie'), { status: 'nameTaken', takenName: 'Dakinspectie' });
eq('leeg: uitslag', S().renameProjectTaskType(S().activeDocumentId, 'ctt-gevel', '   '), { status: 'empty' });
eq('onbekend: uitslag', S().renameProjectTaskType(S().activeDocumentId, 'ctt-bestaat-niet', 'Iets'), { status: 'missing' });
eq('gelijk: uitslag', S().renameProjectTaskType(S().activeDocumentId, 'ctt-gevel', 'Gevelcontrole'), { status: 'unchanged' });
// `ctt-dak` staat in het project maar geen taak gebruikt hem: IFC en herstel bewaren hem niet, dus geen hernoeming.
eq('ongebruikt: uitslag', S().renameProjectTaskType(S().activeDocumentId, 'ctt-dak', 'Dakcontrole'), { status: 'unused' });
eq('ander document: uitslag', S().renameProjectTaskType('doc-bestaat-niet', 'ctt-gevel', 'Gevelronde'), { status: 'otherDocument' });
eq('geweigerd: namen ongewijzigd', projectNames(), namesBefore);
eq('geweigerd: geen ongedaan-maakstap', applied(), stepsBefore);
// Alleen hoofdletters anders is wél een hernoeming van hetzelfde type.
eq('hoofdletters: uitslag', S().renameProjectTaskType(S().activeDocumentId, 'ctt-gevel', 'GEVELCONTROLE'), { status: 'renamed' });
eq('hoofdletters: nieuwe naam', projectNames()[0], 'ctt-gevel=GEVELCONTROLE');

// Crashherstel: de herstelsnapshot van dit document, gelezen en teruggezet in een verse store, houdt de
// bevestigde naam (zelfde route als de app: serialiseren → herstellezer → restoreDocuments).
const docA = S().activeDocumentId;
const recovered = await readRecoveryDocument({
  id: docA, ifc: serializeRecoverySnapshot(S()), filePath: null,
  isDirty: S().isDirty, datesAsRecorded: S().datesAsRecorded, mtime: null,
}, new Map(), false);
const fresh = createAppStoreContext().store;
eq('herstel: geen document overgeslagen', fresh.getState().restoreDocuments([recovered], docA).skippedIds, []);
eq('herstel: bevestigde naam terug', fresh.getState().customTaskTypes, [{ id: 'ctt-gevel', name: 'GEVELCONTROLE' }]);

// Twee documenten met hetzelfde werksoort-id: de hernoeming hoort bij het document waarin ze gevraagd is.
// Is een ander document actief, dan verandert nergens iets.
const docB = S().newDocument();
S().ensureProjectTaskType({ id: 'ctt-gevel', name: 'Gevel in B' });
const taskB = S().addTask({ name: 'Gevel B' });
S().updateTask(taskB, { taskType: 'USERDEFINED', customTaskTypeId: 'ctt-gevel' });
const stepsB = applied();
eq('documentbinding: vraag uit A terwijl B actief is', S().renameProjectTaskType(docA, 'ctt-gevel', 'Gevel uit A'), { status: 'otherDocument' });
eq('documentbinding: B houdt zijn naam', projectNames(), ['ctt-gevel=Gevel in B']);
eq('documentbinding: geen ongedaan-maakstap', applied(), stepsB);
S().switchDocument(docA);
eq('documentbinding: A houdt zijn naam', projectNames(), ['ctt-gevel=GEVELCONTROLE', 'ctt-dak=Dakinspectie']);
S().switchDocument(docB);
eq('documentbinding: in B zelf mag het', S().renameProjectTaskType(docB, 'ctt-gevel', 'Gevel B nieuw'), { status: 'renamed' });
S().switchDocument(docA);
eq('documentbinding: A blijft daarna gelijk', projectNames(), ['ctt-gevel=GEVELCONTROLE', 'ctt-dak=Dakinspectie']);

// Main liet een ongebruikte definitie al weg uit IFC; dat blijft zo (de schrijfregel verandert niet).
eq('ongebruikt: IFC bewaart alleen de gebruikte definitie', readIFC(writeIFC(buildWriteIFCInput(S(), 'planOnly'))).customTaskTypes, [{ id: 'ctt-gevel', name: 'GEVELCONTROLE' }]);

// ── Ongebruikte projectkopie: de nieuwe naam gaat stil mee (eigenaarsbesluit 18 november 2026) ──
// Zo'n definitie bewaart IFC noch herstel, dus er verandert niets wat bewaard wordt: geen sluitvraag
// (`isDirty` blijft staan) en geen eigen ongedaan-maakstap. Een gebruikte kopie houdt de vraag van #999.
const docC = S().newDocument();
S().ensureProjectTaskType({ id: 'ctt-kozijn', name: 'Kozijnen' });
S().ensureProjectTaskType({ id: 'ctt-stel', name: 'Stelwerk' });
const kozijnTask = S().addTask({ name: 'Kozijn zetten' });
S().updateTask(kozijnTask, { taskType: 'USERDEFINED', customTaskTypeId: 'ctt-kozijn' });
const stelTask = S().addTask({ name: 'Stellen' });
S().updateTask(stelTask, { taskType: 'USERDEFINED', customTaskTypeId: 'ctt-stel' });
// Het laatste gebruik gaat weg; daarna nog een losse bewerking, zodat ongedaan maken iets terug te zetten heeft.
S().updateTask(stelTask, { taskType: 'CONSTRUCTION', customTaskTypeId: undefined });
S().updateTask(kozijnTask, { name: 'Kozijn plaatsen' });
useAppStore.setState({ isDirty: false }); // zoals na opslaan
const events = () => [S().historyEvents.length, S().nextHistorySequence, applied()];
const eventsBefore = events();
eq('stil: uitslag', S().renameUnusedProjectTaskType(docC, 'ctt-stel', '  Stelkozijnen  '), { status: 'renamed' });
eq('stil: nieuwe naam in het project', projectNames(), ['ctt-kozijn=Kozijnen', 'ctt-stel=Stelkozijnen']);
eq('stil: document niet gewijzigd', S().isDirty, false);
eq('stil: geen ongedaan-maakstap', events(), eventsBefore);

// Ongedaan maken van een eerdere bewerking zet de oude naam niet terug zolang de kopie daar ongebruikt is;
// een stand waarin een taak de werksoort nog gebruikte, houdt haar naam van toen (die bewaart IFC wel).
S().undo();
eq('stil: ongedaan maken (taaknaam) houdt de nieuwe naam', [S().tasks.find(t => t.id === kozijnTask)?.name, projectNames()], ['Kozijn zetten', ['ctt-kozijn=Kozijnen', 'ctt-stel=Stelkozijnen']]);
S().undo();
eq('stil: ongedaan maken tot het gebruik terug is: naam van toen', [S().tasks.find(t => t.id === stelTask)?.customTaskTypeId, projectNames()], ['ctt-stel', ['ctt-kozijn=Kozijnen', 'ctt-stel=Stelwerk']]);
S().redo();
S().redo();
eq('stil: opnieuw: weer ongebruikt en de nieuwe naam', [S().tasks.find(t => t.id === stelTask)?.customTaskTypeId, S().tasks.find(t => t.id === kozijnTask)?.name, projectNames()], [undefined, 'Kozijn plaatsen', ['ctt-kozijn=Kozijnen', 'ctt-stel=Stelkozijnen']]);

// Taak bewerken annuleren draait de sessie terug met haar vóór-stand; ook die houdt de nieuwe naam.
const mark = S().historyMark();
S().updateTask(kozijnTask, { name: 'Kozijn in sessie' });
eq('stil: in een bewerksessie', S().renameUnusedProjectTaskType(docC, 'ctt-stel', 'Stelraam'), { status: 'renamed' });
S().revertHistorySince(mark);
eq('stil: Annuleren houdt de nieuwe naam', [S().tasks.find(t => t.id === kozijnTask)?.name, projectNames()], ['Kozijn plaatsen', ['ctt-kozijn=Kozijnen', 'ctt-stel=Stelraam']]);

// Een gebruikte kopie raakt deze actie niet (daar hoort de vraag bij); een botsende naam, een ander
// document, een onbekend type, een lege of gelijke naam veranderen niets, zonder stap en zonder melding.
useAppStore.setState({ isDirty: false });
const quiet = events();
const quietNames = projectNames();
const notices = S().ui.notifications.length;
eq('stil: gebruikt', S().renameUnusedProjectTaskType(docC, 'ctt-kozijn', 'Ramen'), { status: 'inUse' });
eq('stil: botsing', S().renameUnusedProjectTaskType(docC, 'ctt-stel', 'kozijnen'), { status: 'nameTaken', takenName: 'Kozijnen' });
eq('stil: ander document', S().renameUnusedProjectTaskType(docA, 'ctt-stel', 'Stelwerk B'), { status: 'otherDocument' });
eq('stil: onbekend', S().renameUnusedProjectTaskType(docC, 'ctt-bestaat-niet', 'Iets'), { status: 'missing' });
eq('stil: leeg', S().renameUnusedProjectTaskType(docC, 'ctt-stel', '  '), { status: 'empty' });
eq('stil: gelijk', S().renameUnusedProjectTaskType(docC, 'ctt-stel', 'Stelraam'), { status: 'unchanged' });
eq('stil: geweigerd verandert niets', [projectNames(), events(), S().isDirty, S().ui.notifications.length], [quietNames, quiet, false, notices]);

// Knownbug 1834: een bevestigde hernoeming die bij uitvoeren `unused` blijkt (het laatste gebruik ging
// intussen weg), gaat dezelfde weg: de ongebruikte kopie krijgt de naam stil.
applyProjectTaskTypeRename({ documentId: docC, id: 'ctt-stel', oldName: 'Stelraam', newName: 'Stelkozijn' });
eq('1834: uitgestelde hernoeming van een ongebruikte kopie', [projectNames(), events(), S().isDirty], [['ctt-kozijn=Kozijnen', 'ctt-stel=Stelkozijn'], quiet, false]);

// Krijgt een taak de werksoort daarna, dan heeft hij de nieuwe naam, ook na IFC-uitvoer en herlezing.
S().updateTask(stelTask, { taskType: 'USERDEFINED', customTaskTypeId: 'ctt-stel' });
eq('stil: daarna toegekend: nieuwe naam in het IFC', readIFC(writeIFC(buildWriteIFCInput(S(), 'planOnly'))).customTaskTypes, [{ id: 'ctt-kozijn', name: 'Kozijnen' }, { id: 'ctt-stel', name: 'Stelkozijn' }]);

if (errors.length) {
  for (const error of errors) console.error(`XX ${error}`);
  process.exitCode = 1;
} else console.log('OK custom task types: IFC + CSV/MSPDI/P6 id+naam round-trip, foreign fallback en hernoemen in het project');
