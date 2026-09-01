// X9-R2 — de echte exportAs-route levert uitsluitend werkelijk aanwezig, per writer bepaald
// XER-verlies terug. X10 vertaalt/toont dit later; deze headless check bewaakt de return-envelope.
import {
  bindXerImportMetadataToArchive,
  createEmptyXerArchiveDiagnostics,
  createEmptyXerArchiveDocumentView,
  createEmptyXerArchiveReadModel,
  createXerSourceArchive,
} from '@/services/xerSourceArchive';
import type { XerImportMetadata } from '@/services/importTypes';
import { EXPORT_FORMATS } from '@/services/formatRegistry';
import { xerExportTargetVerdict } from '@/services/xerExportLoss';
import { parseXerTables } from '@/services/xer/xerTables';
import { readFileSync } from 'node:fs';

declare const process: { exit(code: number): never };
const failures: string[] = [];
let checks = 0;
const expect = (label: string, condition: boolean) => {
  checks += 1;
  if (!condition) failures.push(label);
};

const captures: string[] = [];
const global = globalThis as Record<string, any>;
global.window = global.window ?? {};
global.Blob = class {
  constructor(parts: unknown[]) { captures.push(parts.join('')); }
};
global.URL = global.URL ?? {};
global.URL.createObjectURL = () => 'blob:x9-export-loss';
global.URL.revokeObjectURL = () => undefined;
global.document = {
  createElement: () => ({ href: '', download: '', click: () => undefined }),
};

const { useAppStore } = await import('@/state/appStore');
const store = () => useAppStore.getState();

function makeXerFixture(options: {
  sourceBytes?: string;
  unknownTable?: boolean;
  typedDiagnostic?: boolean;
} = {}) {
  const sourceProjectId = 'P-X9-LOSS';
  const view = createEmptyXerArchiveDocumentView(sourceProjectId);
  const readModel = createEmptyXerArchiveReadModel();
  const diagnostics = {
    ...createEmptyXerArchiveDiagnostics(),
    documentViews: { [sourceProjectId]: view },
  };
  if (options.unknownTable) {
    diagnostics.file.tableReport.unknownTables.push({ name: 'UNKNOWN_RETAINED', rows: 1 });
  }
  if (options.typedDiagnostic) {
    diagnostics.file.tableReport.issues.push({
      code: 'XER_ROW_FIELD_COUNT_MISMATCH', line: 7, table: 'TASK', expected: 4, actual: 3,
    });
  }
  const archive = createXerSourceArchive(
    new TextEncoder().encode(options.sourceBytes ?? ''),
    { encoding: 'utf-8', bom: 'none', newline: options.sourceBytes ? 'crlf' : 'none', diagnostics, readModel },
  );
  return {
    archive,
    xer: bindXerImportMetadataToArchive(archive, sourceProjectId),
    sourceProjectId,
  };
}

function makeParsedXerFixture(source: string) {
  const bytes = new TextEncoder().encode(source);
  const parsed = parseXerTables(bytes);
  const fixture = makeXerFixture({ sourceBytes: source });
  const diagnostics = {
    ...fixture.archive.diagnostics,
    file: { ...fixture.archive.diagnostics.file, tableReport: parsed.report },
  };
  const archive = createXerSourceArchive(bytes, {
    encoding: 'utf-8', bom: 'none', newline: 'crlf',
    diagnostics,
    readModel: fixture.archive.readModel,
  });
  return {
    archive,
    xer: bindXerImportMetadataToArchive(archive, fixture.sourceProjectId),
    sourceProjectId: fixture.sourceProjectId,
  };
}

function installXer(fixture: ReturnType<typeof makeXerFixture>, xer: XerImportMetadata = fixture.xer) {
  useAppStore.setState({
    xerSourceArchive: fixture.archive,
    xerImportMetadata: xer,
    xerSourceProjectId: fixture.sourceProjectId,
    scheduleStale: false,
  });
}

function categoriesOf(result: any): string[] {
  if (!result?.ok || !Array.isArray(result.warnings) || result.warnings.length === 0) return [];
  return [...(result.warnings[0]?.categories ?? [])];
}

function expectCategories(label: string, format: string, result: any, expected: readonly string[]) {
  expect(label, result?.ok === true
    && Array.isArray(result.warnings)
    && (expected.length === 0
      ? result.warnings.length === 0
      : result.warnings.length === 1
        && result.warnings[0]?.code === 'XER_ONLY_DATA_NOT_EXPRESSIBLE'
        && result.warnings[0]?.format === format
        && result.warnings[0]?.availability === 'supported-lossy'
        && JSON.stringify(categoriesOf(result)) === JSON.stringify(expected)));
}

function resetProject(name: string) {
  store().newProject();
  store().setProject({ name, startDate: '2034-01-02' });
  useAppStore.setState({ scheduleStale: false });
}

function clearNotifications() {
  for (const notification of [...store().ui.notifications]) store().dismissNotification(notification.id);
}

function xerLossNotifications() {
  return store().ui.notifications.filter(notification =>
    (notification.messageKey as string) === 'notifications.xerExportLoss');
}

function failNextSave(error: Error) {
  global.window.showOpenFilePicker = async () => [];
  global.window.showSaveFilePicker = async () => { throw error; };
}

function restoreDownloadSave() {
  delete global.window.showOpenFilePicker;
  delete global.window.showSaveFilePicker;
}

// Negatief 1: een gewoon niet-XER-project mag geen false warning krijgen.
resetProject('Schoon niet-XER');
const cleanCsv = await store().exportAs('csv');
expectCategories('een schoon niet-XER-project geeft geen XER-lossmelding', 'csv', cleanCsv, []);

// Negatief 2: alleen een lege archive/importmetadata-binding is geen verliescategorie.
resetProject('Lege XER-binding');
const emptyXer = makeXerFixture();
installXer(emptyXer);
for (const format of ['csv', 'mspdi', 'p6'] as const) {
  expectCategories(`${format}: een inhoudelijk lege XER-binding geeft geen false warning`,
    format, await store().exportAs(format), []);
}
const emptyIfc = await store().exportAs('ifc');
expect('IFC blijft ook voor een lege XER-binding lossless', emptyIfc.ok && categoriesOf(emptyIfc).length === 0);

// Capabilityfixture: MSPDI projecteert de actieve baseline-taakwaarden, CriticalSlackLimit en
// Units/Work/WorkContour. De baselinecategorie blijft wél nodig voor het niet-roundtrippende
// OPS-baselineobject; de andere twee writerprojecties mogen geen extra categorie veroorzaken.
resetProject('Capabilityfixture');
const capTask = store().addTask({ name: 'Geprojecteerde taak' });
const capResource = store().addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 1 });
store().assignResource(capTask, capResource, 0.5, 'BELL');
const activeBaselineId = store().saveBaseline('Actief');
store().setProject({ schedulingOptions: { criticalDefinition: { mode: 'totalFloat', threshold: 2 } } });
installXer(makeXerFixture());

const capMspdi = await store().exportAs('mspdi');
const capMspdiXml = captures.at(-1) ?? '';
expectCategories('MSPDI meldt baseline-metadataverlies naast de bewezen slot-0-taakprojectie',
  'mspdi', capMspdi, ['baselines']);
expect('MSPDI-writer schreef de actieve baseline werkelijk',
  capMspdiXml.includes('<Baseline>') && capMspdiXml.includes('<Number>0</Number>'));
expect('MSPDI-writer schreef CriticalSlackLimit werkelijk', capMspdiXml.includes('<CriticalSlackLimit>2</CriticalSlackLimit>'));
expect('MSPDI-writer schreef Units/Work/WorkContour werkelijk',
  capMspdiXml.includes('<Units>0.5</Units>')
  && capMspdiXml.includes('<Work>')
  && capMspdiXml.includes('<WorkContour>6</WorkContour>'));

const capCsv = await store().exportAs('csv');
expectCategories('CSV meldt de werkelijk niet geschreven baseline/assignment/schedule-opties',
  'csv', capCsv, ['baselines', 'raw-curves-and-assignment-quantities', 'schedule-options-and-provenance']);
expect('de capabilityfixture houdt exact één geldige actieve baseline',
  store().baselines.length === 1 && store().activeBaselineId === activeBaselineId);

resetProject('Alleen onbekende tabel');
installXer(makeParsedXerFixture([
  'ERMHDR\t23.12',
  '%T\tVENDOR_TABLE',
  '%F\tvalue',
  '%R\tretained',
  '%E',
].join('\r\n')));
expectCategories('onbekende tabel met een retained rij activeert zelfstandig de categorie',
  'csv', await store().exportAs('csv'), ['exact-source-bytes', 'unknown-tables-and-fields']);

resetProject('Alleen onbekend veld');
installXer(makeParsedXerFixture([
  'ERMHDR\t23.12',
  '%T\tPROJECT',
  '%F\tproj_id\tmystery_vendor_field',
  '%R\tP1\tretained-value',
  '%E',
].join('\r\n')));
expectCategories('onbekend gevuld veld in bekende tabel activeert zelfstandig de categorie',
  'csv', await store().exportAs('csv'), ['exact-source-bytes', 'unknown-tables-and-fields']);

// Samengestelde fixture voor de overige onafhankelijke categorieën. De drie relation-/assignment-
// degradaties staan hier BEWUST niet in: ieder daarvan krijgt hieronder een eigen fixture, zodat
// één productietak nooit door een tweede oorzaak voor dezelfde categorie gemaskeerd kan worden.
resetProject('Rijke XER-data');
const firstTask = store().addTask({ name: 'Bronactiviteit' });
const codeTypeId = store().addActivityCodeType('Discipline');
const codeValueId = store().addActivityCodeValue(codeTypeId, { code: 'B', description: 'Bouw' });
store().setTaskActivityCode(firstTask, codeTypeId, codeValueId);
const udfId = store().addCustomField('Bronwaarde', 'text');
store().setTaskCustomField(firstTask, udfId, 'XER');
store().updateTask(firstTask, {
  notes: [{ id: 'note-1', text: 'Alleen in OPS', done: false }],
  externalLinks: [{
    id: 'ext-1', direction: 'predecessor', relType: 'FS', anchorDate: '2034-01-02',
    sourceRef: { projectId: 'P-OTHER', taskId: 'T-OTHER' }, sourceMissing: false,
  }],
});
store().saveBaseline('Eerste');
store().saveBaseline('Tweede actief');
store().setProject({
  progressMode: 'PROGRESS_OVERRIDE',
  schedulingOptions: { p6Source: 'XER', lagCalendar: '24hour', makeOpenEndedCritical: true },
});

const richFixture = makeXerFixture({
  sourceBytes: '%T\tTASK\r\n%F\ttask_id\r\n%R\torigineel\r\n%E',
  typedDiagnostic: true,
});
installXer(richFixture);

const sharedRich = [
  'exact-source-bytes',
  'typed-diagnostics',
  'baselines',
  'udfs',
  'activity-codes',
  'notes',
  'external-links',
  'schedule-options-and-provenance',
] as const;

const richResults = [];
for (const format of ['csv', 'mspdi', 'p6', 'ifc'] as const) {
  richResults.push([format, await store().exportAs(format)] as const);
}
for (const [format, result] of richResults) {
  if (format === 'ifc') {
    expect('IFC blijft buiten de lossy-funnel', result.ok && categoriesOf(result).length === 0);
  } else {
    expectCategories(`${format} meldt alleen werkelijk aanwezige retained/live categorieën in de return-envelope`,
      format, result, sharedRich);
  }
}

expect('succes-warnings blijven onderdeel van de bestaande exportAs-return-envelope',
  richResults.filter(([format]) => format !== 'ifc').every(([, result]) =>
    result.ok && 'warnings' in result && Array.isArray(result.warnings) && result.warnings.length === 1));

function installRelationFixture(name: string, relation: { lagPercent?: number; lagUnit?: 'ELAPSEDTIME' }) {
  resetProject(name);
  const predecessorId = store().addTask({ name: `${name} voorganger` });
  const successorId = store().addTask({ name: `${name} opvolger` });
  store().addSequence({
    predecessorId, successorId, type: 'FINISH_START', lagDays: 1,
    ...relation,
  });
  installXer(makeXerFixture());
}

installRelationFixture('Alleen percentlag', { lagPercent: 25 });
const percentOnly = await store().exportAs('p6');
expectCategories('P6-percentlag zonder elapsed-signaal activeert zelfstandig relation degradation',
  'p6', percentOnly, ['p6-relation-lag-degradation']);

installRelationFixture('Alleen elapsed lag', { lagUnit: 'ELAPSEDTIME' });
const elapsedOnly = await store().exportAs('p6');
expectCategories('P6-elapsed-lag zonder percent-signaal activeert zelfstandig relation degradation',
  'p6', elapsedOnly, ['p6-relation-lag-degradation']);

function installAssignmentFixture(name: string, curve: 'BELL' | 'LATE_PEAK') {
  resetProject(name);
  const taskId = store().addTask({ name: `${name} taak` });
  const resourceId = store().addResource({ name: `${name} ploeg`, type: 'LABOR', description: '', maxUnits: 1 });
  store().assignResource(taskId, resourceId, 0.5, curve);
  const fixture = makeXerFixture();
  installXer(fixture);
  return fixture;
}

installAssignmentFixture('Alleen LATE_PEAK', 'LATE_PEAK');
const latePeakOnly = await store().exportAs('p6');
expectCategories('P6-LATE_PEAK zonder retained quantities activeert zelfstandig assignmentverlies',
  'p6', latePeakOnly, ['raw-curves-and-assignment-quantities']);

const retainedFixture = installAssignmentFixture('Alleen retained quantities', 'BELL');
const retainedAssignment = {
  rawRow: { line: 12, cells: { target_qty: '40', remain_qty: '12' } },
  sourceId: 'A-1', internalId: 'A-1', taskSourceId: 'T-1', projectSourceId: retainedFixture.sourceProjectId,
  line: 12, entity: { kind: 'RESOURCE' as const, sourceId: 'R-1', internalId: 'R-1' },
  unitScale: 'DIRECT_FRACTION' as const,
  quantities: { target: 40, remaining: 12 },
  rawCurves: {},
  costs: {},
};
installXer(retainedFixture, {
  ...retainedFixture.xer,
  resources: {
    catalog: retainedFixture.archive.readModel.resourceCatalog,
    assignments: [retainedAssignment],
    issues: [],
  },
});
const retainedOnly = await store().exportAs('p6');
expectCategories('retained quantities met ondersteunde live curve activeren zelfstandig assignmentverlies',
  'p6', retainedOnly, ['raw-curves-and-assignment-quantities']);

installAssignmentFixture('Ondersteunde P6-curve', 'BELL');
const supportedCurve = await store().exportAs('p6');
const supportedCurveXml = captures.at(-1) ?? '';
expectCategories('ondersteunde P6-curve zonder retained bronwaarden geeft geen false positive',
  'p6', supportedCurve, []);
expect('P6-writer schreef voor die negatieve fixture PlannedUnitsPerTime/PlannedCurve werkelijk',
  supportedCurveXml.includes('<PlannedUnitsPerTime>0.5</PlannedUnitsPerTime>')
  && supportedCurveXml.includes('<PlannedCurve>Bell Shaped</PlannedCurve>'));

// De centrale exportAs-funnel is de eigenaar van de in-app melding. Daardoor krijgen Backstage en
// ribbon exact hetzelfde gedrag zonder twee meldschrijvers. Alleen een bewezen save mag melden;
// cancel en error mogen noch de toast noch waarschuwingen in een succes-envelope laten lekken.
resetProject('Centrale exportmelding');
store().addTask({ name: 'Meldingstaak' });
store().saveBaseline('Meldingsbaseline');
installXer(makeXerFixture());
clearNotifications();
const notifiedSuccess = await store().exportAs('csv');
expect('succesvolle echte store-export geeft één centrale XER-lossmelding met Lees meer',
  notifiedSuccess.ok
  && xerLossNotifications().length === 1
  && xerLossNotifications()[0]?.helpArticleId === 'gids-xer-import');

clearNotifications();
failNextSave(new DOMException('geannuleerd', 'AbortError'));
const cancelled = await store().exportAs('csv');
restoreDownloadSave();
expect('cancel geeft aantoonbaar warnings=[] en geen in-app lossmelding',
  cancelled.ok && cancelled.warnings.length === 0 && xerLossNotifications().length === 0);

clearNotifications();
failNextSave(new Error('schrijffout'));
let saveRejected = false;
try {
  await store().exportAs('csv');
} catch {
  saveRejected = true;
}
restoreDownloadSave();
expect('save-error produceert geen XER-lossmelding', saveRejected && xerLossNotifications().length === 0);

clearNotifications();
await store().exportAs('csv');
await store().exportAs('csv');
expect('herhaalde export vanuit dezelfde centrale funnel dedupet tot één melding',
  xerLossNotifications().length === 1 && xerLossNotifications()[0]?.count === 2);

const backstageSource = readFileSync('src/components/backstage/Backstage.tsx', 'utf8');
const ribbonSource = readFileSync('src/components/layout/Ribbon/ribbonWidgets.tsx', 'utf8');
expect('Backstage en ribbon roepen beide uitsluitend de centrale exportAs-funnel aan',
  backstageSource.includes('await exportAs(format)')
  && ribbonSource.includes('void exportAs(f.format)')
  && !backstageSource.includes('notifications.xerExportLoss')
  && !ribbonSource.includes('notifications.xerExportLoss'));

expect('alle werkelijk succesvolle exportpaden schreven uitvoer', captures.length >= 18 && captures.every(Boolean));
expect('MPP heeft geen misleidende exportadapter en blijft expliciet unsupported',
  !EXPORT_FORMATS.some(item => (item.format as string) === 'mpp')
  && xerExportTargetVerdict('mpp') === 'unsupported');

if (failures.length === 0) {
  console.log(`OK  xer-export-loss: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  xer-export-loss: ${failures.length} afwijking(en) van ${checks}`);
for (const failure of failures) console.log(`   - ${failure}`);
process.exit(1);
