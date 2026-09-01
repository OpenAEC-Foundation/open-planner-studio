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

// Capabilityfixture: alleen data die MSPDI en P6 aantoonbaar projecteren. Eén actieve baseline en
// CriticalSlackLimit zijn MSPDI-lossless; Units/Work/WorkContour en PlannedUnits/PlannedCurve
// voorkomen dat een gewone live assignment als "raw retained" wordt overgewaarschuwd.
resetProject('Capabilityfixture');
const capTask = store().addTask({ name: 'Geprojecteerde taak' });
const capResource = store().addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 1 });
store().assignResource(capTask, capResource, 0.5, 'BELL');
const activeBaselineId = store().saveBaseline('Actief');
store().setProject({ schedulingOptions: { criticalDefinition: { mode: 'totalFloat', threshold: 2 } } });
installXer(makeXerFixture());

const capMspdi = await store().exportAs('mspdi');
const capMspdiXml = captures.at(-1) ?? '';
expectCategories('MSPDI meldt ondersteunde active baseline/CriticalSlackLimit/assignment niet als verlies',
  'mspdi', capMspdi, []);
expect('MSPDI-writer schreef de actieve baseline werkelijk',
  capMspdiXml.includes('<Baseline>') && capMspdiXml.includes('<Number>0</Number>'));
expect('MSPDI-writer schreef CriticalSlackLimit werkelijk', capMspdiXml.includes('<CriticalSlackLimit>2</CriticalSlackLimit>'));
expect('MSPDI-writer schreef Units/Work/WorkContour werkelijk',
  capMspdiXml.includes('<Units>0.5</Units>')
  && capMspdiXml.includes('<Work>')
  && capMspdiXml.includes('<WorkContour>6</WorkContour>'));

const capP6 = await store().exportAs('p6');
const capP6Xml = captures.at(-1) ?? '';
expectCategories('P6 verliest de baseline/schedule-opties maar niet de normale assignmentprojectie',
  'p6', capP6, ['baselines', 'schedule-options-and-provenance']);
expect('P6-writer schreef PlannedUnitsPerTime/PlannedCurve werkelijk',
  capP6Xml.includes('<PlannedUnitsPerTime>0.5</PlannedUnitsPerTime>')
  && capP6Xml.includes('<PlannedCurve>Bell Shaped</PlannedCurve>'));

const capCsv = await store().exportAs('csv');
expectCategories('CSV meldt de werkelijk niet geschreven baseline/assignment/schedule-opties',
  'csv', capCsv, ['baselines', 'raw-curves-and-assignment-quantities', 'schedule-options-and-provenance']);
expect('de capabilityfixture houdt exact één geldige actieve baseline',
  store().baselines.length === 1 && store().activeBaselineId === activeBaselineId);

// Positieve fixture: elk signaal is concreet aanwezig. De verwachte arrays zijn onafhankelijk van
// productieconstanten uitgeschreven; formatverschillen komen uit het hierboven bewezen writergedrag.
resetProject('Rijke XER-data');
const firstTask = store().addTask({ name: 'Bronactiviteit' });
const secondTask = store().addTask({ name: 'Opvolger' });
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
store().addSequence({
  predecessorId: firstTask, successorId: secondTask, type: 'FINISH_START', lagDays: 1,
  lagPercent: 25, lagUnit: 'ELAPSEDTIME',
});
const richResource = store().addResource({ name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1 });
store().assignResource(firstTask, richResource, 0.75, 'LATE_PEAK');
store().saveBaseline('Eerste');
store().saveBaseline('Tweede actief');
store().setProject({
  progressMode: 'PROGRESS_OVERRIDE',
  schedulingOptions: { p6Source: 'XER', lagCalendar: '24hour', makeOpenEndedCritical: true },
});

const richFixture = makeXerFixture({
  sourceBytes: '%T\tUNKNOWN_RETAINED\r\n%F\tx\r\n%R\torigineel\r\n%E',
  unknownTable: true,
  typedDiagnostic: true,
});
const retainedAssignment = {
  rawRow: { line: 12, cells: { target_qty: '40', remain_qty: '12', target_crv: 'CURVE-X' } },
  sourceId: 'A-1', internalId: 'A-1', taskSourceId: 'T-1', projectSourceId: richFixture.sourceProjectId,
  line: 12, entity: { kind: 'RESOURCE' as const, sourceId: 'R-1', internalId: 'R-1' },
  unitScale: 'DIRECT_FRACTION' as const,
  quantities: { target: 40, remaining: 12 },
  rawCurves: { target: 'CURVE-X' },
  costs: {},
};
const richXer: XerImportMetadata = {
  ...richFixture.xer,
  resources: {
    catalog: richFixture.archive.readModel.resourceCatalog,
    assignments: [retainedAssignment],
    issues: [],
  },
};
installXer(richFixture, richXer);

const sharedRich = [
  'exact-source-bytes',
  'unknown-tables-and-fields',
  'typed-diagnostics',
  'baselines',
  'udfs',
  'activity-codes',
  'notes',
  'raw-curves-and-assignment-quantities',
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
  } else if (format === 'p6') {
    expectCategories('P6 meldt retained/live verlies plus relation-lag-degradatie in de return-envelope',
      format, result, [...sharedRich, 'p6-relation-lag-degradation']);
  } else {
    expectCategories(`${format} meldt alleen werkelijk aanwezige retained/live categorieën in de return-envelope`,
      format, result, sharedRich);
  }
}

expect('succes-warnings blijven onderdeel van de bestaande exportAs-return-envelope',
  richResults.filter(([format]) => format !== 'ifc').every(([, result]) =>
    result.ok && 'warnings' in result && Array.isArray(result.warnings) && result.warnings.length === 1));
expect('alle twaalf echte exportpaden schreven daadwerkelijk uitvoer', captures.length === 12 && captures.every(Boolean));
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
