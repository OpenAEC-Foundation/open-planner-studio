// P0 XER-bronretentiecontract — corpusloos, over echte gebruikersgrenzen en met onafhankelijke
// STEP-inspectie. Mutanten veranderen geldige inhoud; elke grens moet daardoor inhoudelijk rood zijn.
import { activeImportResult } from '@/services/importTypes';
import { readXerArchiveIFC as readIFC } from './xerArchiveTestReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { clearRecovery, fullRecoverySave, loadRecovery, saveRecovery } from '@/services/recovery/recoveryStore';
import { readXER } from '@/services/xer/xerReader';
import { detectXerExportLoss } from '@/services/xerExportLoss';
import { decodeXerSourceArchive, sha256Hex } from '@/services/xerSourceArchive';
import { createAppStore, type AppState } from '@/state/appStore';
import { payloadFromImport, recoveryInputFromParsed } from '@/state/documentContract';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';

declare const process: { env: Record<string, string | undefined>; exit(code: number): never };

const mutantNames = [
  'import-hydrate',
  'run-cpm',
  'snapshot-undo-redo',
  'document-switch',
  'duplicate',
  'recovery-write-load-restore',
  'ifc-writer-reader',
  'independent-step',
] as const;
type MutantName = typeof mutantNames[number];
const mutant = process.env.OPS_XER_RETENTION_MUTANT as MutantName | undefined;
if (mutant && !mutantNames.includes(mutant)) throw new Error(`Onbekende retentiemutant: ${mutant}`);

const failures: string[] = [];
let checks = 0;
const normalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [
      key, normalize((value as Record<string, unknown>)[key]),
    ]));
  }
  return value;
};
const firstDifference = (actual: unknown, expected: unknown, path = '$'): string => {
  const left = normalize(actual);
  const right = normalize(expected);
  if (JSON.stringify(left) === JSON.stringify(right)) return path;
  if (Array.isArray(left) && Array.isArray(right)) {
    const size = Math.max(left.length, right.length);
    for (let index = 0; index < size; index += 1) {
      if (JSON.stringify(left[index]) !== JSON.stringify(right[index])) {
        return firstDifference(left[index], right[index], `${path}[${index}]`);
      }
    }
  }
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    for (const key of keys) {
      const leftValue = (left as Record<string, unknown>)[key];
      const rightValue = (right as Record<string, unknown>)[key];
      if (JSON.stringify(leftValue) !== JSON.stringify(rightValue)) {
        return firstDifference(leftValue, rightValue, `${path}.${key}`);
      }
    }
  }
  return path;
};
const equal = (label: string, actual: unknown, expected: unknown) => {
  checks += 1;
  if (JSON.stringify(normalize(actual)) !== JSON.stringify(normalize(expected))) {
    failures.push(`${label}: inhoud wijkt af bij ${firstDifference(actual, expected)}`);
  }
};
const truthy = (label: string, value: boolean) => {
  checks += 1;
  if (!value) failures.push(`${label}: voorwaarde is niet vervuld`);
};

// De browserrand is nep; recoveryStore, IFC-write/read en documentrestore zijn echt.
const records = new Map<string, unknown>();
const fakeDb = {
  objectStoreNames: { contains: () => true },
  createObjectStore: () => undefined,
  close: () => undefined,
  onversionchange: null as (() => void) | null,
  transaction: (_store: string, _mode: string) => {
    const tx = {
      oncomplete: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onabort: null as (() => void) | null,
      error: null,
      abort: () => tx.onabort?.(),
      objectStore: () => ({
        getAll: () => {
          const request = {
            result: [] as unknown[],
            error: null,
            onsuccess: null as (() => void) | null,
            onerror: null as (() => void) | null,
          };
          queueMicrotask(() => {
            request.result = [...records.values()];
            request.onsuccess?.();
          });
          return request;
        },
        put: (value: { id: string }) => {
          records.set(value.id, structuredClone(value));
          queueMicrotask(() => tx.oncomplete?.());
        },
        delete: (id: string) => {
          records.delete(id);
          queueMicrotask(() => tx.oncomplete?.());
        },
      }),
    };
    return tx;
  },
};
(globalThis as unknown as { window: object }).window = {};
(globalThis as unknown as { indexedDB: unknown }).indexedDB = {
  open: () => {
    const request = {
      result: fakeDb,
      error: null,
      onupgradeneeded: null as (() => void) | null,
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };
    queueMicrotask(() => {
      request.onupgradeneeded?.();
      request.onsuccess?.();
    });
    return request;
  },
};

// Drie bronchunks, een onbekende tabel en een onbekend taakveld. De kalenderpayload is echte P6-XER:
// dubbele/non-work exceptions leveren p6NonWorkPenaltyDates op; de FS-relatie begint exact op de
// target-finishgrens van de voorganger en levert zo de sequence-boundaryvlag op.
const unknownPayload = 'onbekende-bronwaarde-'.repeat(24_000);
const bytes = new TextEncoder().encode([
  'ERMHDR\t23.12\t2025-12-31\t\t\t\t\t\tEUR',
  '%T\tCURRTYPE',
  '%F\tcurr_short_name\tdecimal_symbol\tdigit_group_symbol',
  '%R\tEUR\tcomma\tperiod',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
  '%R\tP-RET\tBronretentie\tC-RET\t2025-12-31 08:00',
  '%T\tSCHEDOPTIONS',
  '%F\tschedoptions_id\tproj_id\tsched_use_expect_end_flag',
  '%R\tSO-RET\tP-RET\tY',
  '%R\tSO-DUP\tP-RET\tY',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC-RET\tBronkalender\tCA_Base\t\t40\t(0||CalendarData()((0||DaysOfWeek()((0||1()())(0||2()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||3()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||4()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||5()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||6()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||7()())))(0||Exceptions()((0||0(d|46025)())(0||1(d|46027)())(0||2(d|46027)())(0||3(d|46028)((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||4(d|46027)())))))',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\tcomplete_pct\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\texpect_end_date\tsuspend_date\tresume_date\tfuture_vendor_field',
  '%R\tT-PRED\tP-RET\tC-RET\tPRED\tVoorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t0\t8\t8\t2025-12-31 08:00\t2025-12-31 17:00\t2025-12-31 17:00\t2025-12-31 10:00\t2025-12-31 12:00\tbehouden-A',
  '%R\tT-SUCC\tP-RET\tC-RET\tSUCC\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t0\t8\t8\t2025-12-31 17:00\t2026-01-01 17:00\t2026-01-01 17:00\t2026-01-01 10:00\t2026-01-01 12:00\tbehouden-B',
  '%T\tTASKPRED',
  '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
  '%R\tREL-RET\tT-SUCC\tT-PRED\tP-RET\tP-RET\tPR_FS\t0',
  '%T\tRSRC',
  '%F\trsrc_id\trsrc_name\trsrc_type\tclndr_id\tdef_qty_per_hr',
  '%R\tR-RET\tVakman\tRT_Labor\tC-RET\t1',
  '%T\tTASKRSRC',
  '%F\ttaskrsrc_id\tproj_id\ttask_id\trsrc_id\ttarget_qty_per_hr\tremain_qty\ttarget_qty',
  '%R\tAS-RET\tP-RET\tT-SUCC\tR-RET\t1\t8\t8',
  '%T\tACTVTYPE',
  '%F\tactv_code_type_id\tactv_code_type\tseq_num',
  '%R\tTYPE-RET\tFase\t1',
  '%T\tACTVCODE',
  '%F\tactv_code_id\tactv_code_type_id\tshort_name\tseq_num',
  '%R\tVALUE-RET\tTYPE-RET\tBouw\t1',
  '%T\tTASKACTV',
  '%F\tproj_id\ttask_id\tactv_code_type_id\tactv_code_id',
  '%R\tP-RET\tT-SUCC\tTYPE-RET\tVALUE-RET',
  '%T\tUDFTYPE',
  '%F\tudf_type_id\ttable_name\tudf_type_label\tlogical_data_type',
  '%R\tUDF-RET\tTASK\tBronlabel\tFT_STATICTYPE',
  '%T\tUDFVALUE',
  '%F\tudf_type_id\tproj_id\tfk_id\tudf_text',
  '%R\tUDF-RET\tP-RET\tT-SUCC\tNiet verliezen',
  '%T\tVENDOR_UNKNOWN',
  '%F\tvendor_payload',
  '%R\t' + unknownPayload,
  '%E',
].join('\r\n'));

const expectedP6 = {
  taskFields: [
    { p6DurationType: 'DT_FixedDUR2', p6ActivityType: 'TT_Task', p6ProjectId: 'P-RET', p6TaskId: 'T-PRED', p6ExplicitTargetWindow: true, p6CompletePctType: 'CP_Drtn', p6ExpectedFinish: '2025-12-31T17:00', p6SuspendResume: true },
    { p6DurationType: 'DT_FixedDUR2', p6ActivityType: 'TT_Task', p6ProjectId: 'P-RET', p6TaskId: 'T-SUCC', p6ExplicitTargetWindow: true, p6CompletePctType: 'CP_Drtn', p6ExpectedFinish: '2026-01-01T17:00', p6SuspendResume: true },
  ],
  calendar: {
    p6Source: 'XER',
    p6NonWorkPenaltyDates: ['2026-01-03', '2026-01-05'],
    p6NonWorkPenaltyDatesState: 'VALID_VALUES',
  },
  sequenceBoundary: [true],
};
const expectedLossCategories = [
  'exact-source-bytes',
  'unknown-tables-and-fields',
  'typed-diagnostics',
  'udfs',
  'activity-codes',
  'raw-curves-and-assignment-quantities',
  'schedule-options-and-provenance',
];

type SourceState = Pick<AppState,
  | 'xerSourceArchive' | 'xerSourceProjectId' | 'xerImportMetadata'
  | 'project' | 'calendar' | 'calendars' | 'tasks' | 'sequences'
  | 'assignments' | 'activityCodeTypes' | 'customFieldDefs'
  | 'baselines' | 'activeBaselineId'
>;
const lossCategories = (state: SourceState) =>
  detectXerExportLoss('p6', {
    sourceArchive: state.xerSourceArchive,
    importMetadata: state.xerImportMetadata,
    project: state.project,
    tasks: state.tasks,
    sequences: state.sequences,
    assignments: state.assignments,
    activityCodeTypes: state.activityCodeTypes,
    customFieldDefs: state.customFieldDefs,
    baselines: state.baselines,
    activeBaselineId: state.activeBaselineId,
  })[0]?.categories ?? [];

const chunkPins = (chunks: readonly string[]) => chunks.map((chunk, index) => ({
  index,
  base64Length: chunk.length,
  sha256: sha256Hex(new TextEncoder().encode(chunk)),
}));
const taskP6Fields = (state: SourceState) => state.tasks
  .map(task => ({
    p6DurationType: task.p6DurationType,
    p6ActivityType: task.p6ActivityType,
    p6ProjectId: task.p6ProjectId,
    p6TaskId: task.p6TaskId,
    p6ExplicitTargetWindow: task.p6ExplicitTargetWindow,
    p6CompletePctType: task.p6CompletePctType,
    p6ExpectedFinish: task.p6ExpectedFinish,
    p6SuspendResume: task.p6SuspendResume,
  }))
  .sort((a, b) => (a.p6TaskId ?? '').localeCompare(b.p6TaskId ?? ''));
const p6Projection = (state: SourceState) => ({
  taskFields: taskP6Fields(state),
  calendar: {
    p6Source: state.calendar.p6Source,
    p6NonWorkPenaltyDates: state.calendar.p6NonWorkPenaltyDates,
    p6NonWorkPenaltyDatesState: state.calendar.p6NonWorkPenaltyDatesState,
  },
  sequenceBoundary: state.sequences.map(sequence => sequence.p6StartAtPredecessorFinishBoundary),
});
const sourceSignature = (state: SourceState) => {
  const archive = state.xerSourceArchive;
  if (!archive) throw new Error('P0-fixture verloor het XER-bronarchief');
  const decoded = decodeXerSourceArchive(archive);
  return {
    raw: {
      byteLength: decoded.byteLength,
      sha256: sha256Hex(decoded),
      archiveSha256: archive.sha256,
      chunks: chunkPins(archive.byteChunks),
    },
    selector: state.xerSourceProjectId,
    diagnostics: archive.diagnostics,
    importMetadata: state.xerImportMetadata,
    readModel: {
      schemaVersion: archive.readModel.schemaVersion,
      numberFormat: archive.readModel.numberFormat,
      scheduleRows: archive.readModel.scheduleOptionsSourceArchive.rows,
      scheduleDiagnostics: archive.readModel.scheduleOptionsSourceArchive.diagnostics,
      resourceCatalog: archive.readModel.resourceCatalog,
      metadataCatalog: archive.readModel.metadataCatalog,
      taskSourceRowsByProject: archive.readModel.taskSourceRowsByProject,
    },
    p6: p6Projection(state),
    lossDetectorInput: {
      archiveSha256: archive.sha256,
      selector: state.xerSourceProjectId,
      importSourceProjectId: state.xerImportMetadata?.sourceProjectId,
      taskFields: taskP6Fields(state),
      sequenceBoundary: state.sequences.map(sequence => sequence.p6StartAtPredecessorFinishBoundary),
    },
    lossCategories: lossCategories(state),
  };
};
const scheduleProjection = (state: AppState) => state.tasks
  .map(task => ({
    id: task.id,
    duration: task.time.scheduleDuration,
    durationMinutes: task.time.durationMinutes,
    scheduleStart: task.time.scheduleStart,
    scheduleFinish: task.time.scheduleFinish,
    earlyStart: task.time.earlyStart,
    earlyFinish: task.time.earlyFinish,
    lateStart: task.time.lateStart,
    lateFinish: task.time.lateFinish,
    freeFloat: task.time.freeFloat,
    totalFloat: task.time.totalFloat,
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

interface StepEntity { id: string; type: string; args: string[]; line: string }
const splitStepArgs = (value: string): string[] => {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]!;
    if (char === "'" && quoted && value[index + 1] === "'") {
      current += "''";
      index += 1;
      continue;
    }
    if (char === "'") quoted = !quoted;
    if (!quoted && char === '(') depth += 1;
    if (!quoted && char === ')') depth -= 1;
    if (!quoted && depth === 0 && char === ',') {
      args.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  args.push(current);
  return args;
};
const parseStep = (step: string): Map<string, StepEntity> => {
  const entities = new Map<string, StepEntity>();
  for (const line of step.split(/\r?\n/)) {
    const match = line.match(/^#(\d+)=([A-Z0-9_]+)\((.*)\);$/);
    if (match) entities.set(match[1]!, {
      id: match[1]!,
      type: match[2]!,
      args: splitStepArgs(match[3]!),
      line,
    });
  }
  return entities;
};
const refs = (value: string) => [...value.matchAll(/#(\d+)/g)].map(match => match[1]!);
const ifcString = (value: string) => {
  const match = value.match(/^'(.*)'$/);
  return match ? match[1]!.replace(/''/g, "'") : value;
};
const ifcValue = (value: string): string | number | boolean => {
  const typed = value.match(/^[A-Z0-9_]+\((.*)\)$/);
  const raw = typed?.[1] ?? value;
  if (raw === '.T.') return true;
  if (raw === '.F.') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
  return ifcString(raw);
};
const psetsNamed = (entities: Map<string, StepEntity>, name: string) =>
  [...entities.values()].filter(entity =>
    entity.type === 'IFCPROPERTYSET' && ifcString(entity.args[2] ?? '') === name);
const psetView = (entities: Map<string, StepEntity>, pset: StepEntity) => {
  const properties = refs(pset.args[4] ?? '').map(id => entities.get(id))
    .filter((entity): entity is StepEntity => entity?.type === 'IFCPROPERTYSINGLEVALUE');
  return {
    names: properties.map(property => ifcString(property.args[0] ?? '')),
    values: Object.fromEntries(properties.map(property => [
      ifcString(property.args[0] ?? ''),
      ifcValue(property.args[2] ?? ''),
    ])),
  };
};
const attachedObjectIds = (entities: Map<string, StepEntity>, psetId: string) =>
  [...entities.values()]
    .filter(entity =>
      entity.type === 'IFCRELDEFINESBYPROPERTIES'
      && refs(entity.args[5] ?? '').includes(psetId))
    .flatMap(entity => refs(entity.args[4] ?? ''));
const reorderArchiveProperties = (step: string) => {
  const entities = parseStep(step);
  const archive = psetsNamed(entities, 'OPS_XerSourceArchive')[0];
  if (!archive) throw new Error('Mutant kan OPS_XerSourceArchive niet vinden');
  const propertyIds = refs(archive.args[4] ?? '');
  if (propertyIds.length < 2) throw new Error('Mutant kan archiefproperties niet verwisselen');
  [propertyIds[0], propertyIds[1]] = [propertyIds[1]!, propertyIds[0]!];
  const mutatedArgs = [...archive.args];
  mutatedArgs[4] = `(${propertyIds.map(id => `#${id}`).join(',')})`;
  return step.replace(archive.line, `#${archive.id}=${archive.type}(${mutatedArgs.join(',')});`);
};
const mutateDurationType = (step: string) => {
  const original = "IFCLABEL('DT_FixedDUR2')";
  const replacement = "IFCLABEL('DT_FixedRate')";
  if (!step.includes(original)) throw new Error('Mutant kan DurationType niet vinden');
  return step.replace(original, replacement);
};

const directActive = activeImportResult(readXER(bytes));
// Gerichte productpoort: dit komt rechtstreeks uit echte XER, vóór hydrate of handmatige injectie.
equal('0 readXER leidt kalenderstate, kalenderbron en sequence-boundary uit bronregels af',
  p6Projection(payloadFromImport(directActive, null)), expectedP6);

let hydrateInput = directActive;
if (mutant === 'import-hydrate') {
  hydrateInput = {
    ...directActive,
    xerSourceArchive: directActive.xerSourceArchive && {
      ...directActive.xerSourceArchive,
      readModel: {
        ...directActive.xerSourceArchive.readModel,
        numberFormat: { decimal: '.', group: ',', source: 'default' as const, currencyCode: 'USD' },
      },
    },
  };
}
const app = createAppStore();
const state = () => app.getState();
state().applyLoadedProject(hydrateInput, {
  filePath: null,
  fileHandle: null,
  recompute: false,
  fit: false,
  hourDataNotice: false,
  linkedOpen: true,
});
const baseline = sourceSignature(state());
equal('1 import/hydrate pinnt exact drie bronchunks', baseline.raw.chunks.length, 3);
equal('2 import/hydrate pinnt onbekend, diagnostics, CURRTYPE, bronrijen en catalogi', {
  unknownTables: baseline.diagnostics.file.tableReport.unknownTables,
  unknownFields: baseline.diagnostics.file.tableReport.unknownFields,
  numberFormat: baseline.readModel.numberFormat,
  scheduleRows: baseline.readModel.scheduleRows.length,
  scheduleDiagnostics: baseline.readModel.scheduleDiagnostics.length,
  resourceRows: baseline.readModel.resourceCatalog.rows.assignments.length,
  metadataTypes: baseline.readModel.metadataCatalog.activityCodeTypes.length,
  taskProjects: Object.keys(baseline.readModel.taskSourceRowsByProject),
}, {
  unknownTables: [{ name: 'VENDOR_UNKNOWN', rows: 1 }],
  unknownFields: [{ table: 'TASK', name: 'future_vendor_field', rows: 2 }],
  numberFormat: { decimal: ',', group: '.', source: 'currtype', currencyCode: 'EUR' },
  scheduleRows: 3,
  scheduleDiagnostics: 1,
  resourceRows: 1,
  metadataTypes: 1,
  taskProjects: ['P-RET'],
});
equal('3 import/hydrate pinnt alle P6-provenance', baseline.p6, expectedP6);
equal('4 import/hydrate herberekent alle losscategorieën', baseline.lossCategories, expectedLossCategories);
const retains = (label: string, source: SourceState = state()) =>
  equal(label, sourceSignature(source), baseline);

// Live edit + CPM: verander echte duurinvoer, eis een afgeleide wijziging en pin de bron los daarvan.
state().runCPM();
const beforeEdit = scheduleProjection(state());
const predecessor = state().tasks.find(task => task.p6TaskId === 'T-PRED');
if (!predecessor) throw new Error('P0-fixture mist de voorganger');
state().updateTask(predecessor.id, {
  time: { ...predecessor.time, scheduleDuration: 3, durationMinutes: 1_440 },
});
if (mutant !== 'run-cpm') state().runCPM();
const afterEdit = scheduleProjection(state());
truthy('5 live edit verandert CPM-relevante duurinvoer',
  afterEdit.some((task, index) =>
    task.duration !== beforeEdit[index]?.duration
    || task.durationMinutes !== beforeEdit[index]?.durationMinutes));
truthy('6 runCPM verandert minstens één afgeleide datum of float',
  afterEdit.some((task, index) =>
    task.earlyStart !== beforeEdit[index]?.earlyStart
    || task.earlyFinish !== beforeEdit[index]?.earlyFinish
    || task.lateStart !== beforeEdit[index]?.lateStart
    || task.lateFinish !== beforeEdit[index]?.lateFinish
    || task.freeFloat !== beforeEdit[index]?.freeFloat
    || task.totalFloat !== beforeEdit[index]?.totalFloat));
retains('7 live edit/runCPM behoudt bytes, digest, chunks en alle bronvelden');

state().undo();
equal('8 undo herstelt live invoer en afgeleide toestand exact', scheduleProjection(state()), beforeEdit);
if (mutant === 'snapshot-undo-redo') app.setState({ xerSourceProjectId: null });
retains('9 undo herstelt ook de volledige bronretentie');
if (mutant === 'snapshot-undo-redo') app.setState({ xerSourceProjectId: 'P-RET' });
state().redo();
equal('10 redo zet live invoer en afgeleide toestand exact terug', scheduleProjection(state()), afterEdit);
retains('11 redo zet de volledige bronretentie exact terug');

// Documentwissel.
const sourceDocumentId = state().activeDocumentId;
state().newDocument();
const temporaryDocumentId = state().activeDocumentId;
state().switchDocument(sourceDocumentId);
if (mutant === 'document-switch') app.setState({ xerSourceProjectId: null });
retains('12 documentwissel behoudt de volledige bronretentie');
if (mutant === 'document-switch') app.setState({ xerSourceProjectId: 'P-RET' });
state().closeDocument(temporaryDocumentId);
equal('13 documentwissel houdt exact het brondocument open', {
  count: state().documents.length,
  ids: state().documents.map(document => document.id),
  activeId: state().activeDocumentId,
}, { count: 1, ids: [sourceDocumentId], activeId: sourceDocumentId });

// Duplicatie: veranderlijke payloads zijn gekloond; het diep immutable archief wordt bewust gedeeld.
const duplicateId = state().duplicateDocument('Bronretentie-kopie');
const sourcePayload = state().documents.find(document => document.id === sourceDocumentId)?.payload;
if (!sourcePayload) throw new Error('Duplicatie verloor bronpayload');
equal('14 duplicatie maakt precies één unieke document-id', {
  count: state().documents.length,
  uniqueIds: new Set(state().documents.map(document => document.id)).size,
  activeId: state().activeDocumentId,
}, { count: 2, uniqueIds: 2, activeId: duplicateId });
truthy('15 duplicatie deelt alleen het immutable XER-archief',
  sourcePayload.xerSourceArchive === state().xerSourceArchive
  && sourcePayload.project !== state().project
  && sourcePayload.tasks !== state().tasks
  && sourcePayload.sequences !== state().sequences
  && sourcePayload.resources !== state().resources
  && sourcePayload.assignments !== state().assignments
  && sourcePayload.calendars !== state().calendars
  && sourcePayload.activityCodeTypes !== state().activityCodeTypes
  && sourcePayload.customFieldDefs !== state().customFieldDefs);
const duplicateTask = state().tasks.find(task => task.p6TaskId === 'T-PRED');
const sourceTaskName = sourcePayload.tasks.find(task => task.p6TaskId === 'T-PRED')?.name;
if (!duplicateTask) throw new Error('Duplicatie verloor voorganger');
state().updateTask(duplicateTask.id, { name: 'Alleen in kopie' });
equal('16 mutatie in kopie raakt brondocument niet',
  sourcePayload.tasks.find(task => task.p6TaskId === 'T-PRED')?.name, sourceTaskName);
if (mutant === 'duplicate') app.setState({ xerSourceProjectId: null });
retains('17 duplicatie behoudt de volledige bronretentie');
if (mutant === 'duplicate') app.setState({ xerSourceProjectId: 'P-RET' });

// Recovery: pin opslaginhoud en herstel daarna in een verse store waarvan het startdocument verdwijnt.
const openDocs = state().getOpenDocumentPayloads();
const recoveryWrites = openDocs.map(document => ({
  id: document.id,
  ifc: writeIFC(buildWriteIFCInput(document.payload)),
  filePath: null,
  isDirty: true,
}));
const expectedRecovery = recoveryWrites.map((document, index) => ({
  id: document.id,
  ifcSha256: sha256Hex(new TextEncoder().encode(document.ifc)),
  source: sourceSignature(openDocs[index]!.payload),
}));
await clearRecovery();
if (mutant !== 'recovery-write-load-restore') {
  await saveRecovery(fullRecoverySave(duplicateId, recoveryWrites));
}
const loadedRecovery = await loadRecovery();
equal('18 recovery write/load pinnt exacte aantallen, ids, actieve id en IFC-inhoud', {
  count: loadedRecovery.docs.length,
  ids: loadedRecovery.docs.map(document => document.id),
  activeId: loadedRecovery.activeDocumentId,
  ifcSha256: loadedRecovery.docs.map(document => sha256Hex(new TextEncoder().encode(document.ifc))),
}, {
  count: expectedRecovery.length,
  ids: expectedRecovery.map(document => document.id),
  activeId: duplicateId,
  ifcSha256: expectedRecovery.map(document => document.ifcSha256),
});
const recoveryShapeOk =
  loadedRecovery.docs.length === expectedRecovery.length
  && loadedRecovery.docs.every((document, index) => document.id === expectedRecovery[index]?.id);
if (recoveryShapeOk) {
  loadedRecovery.docs.forEach((document, index) => {
    equal(`19 recovery load pinnt bronhandtekening document ${index + 1}`,
      sourceSignature(payloadFromImport(readIFC(document.ifc), null)), expectedRecovery[index]!.source);
  });
}
const recoveredApp = createAppStore();
const initialFreshDocumentId = recoveredApp.getState().activeDocumentId;
recoveredApp.getState().newDocument();
const freshDocumentId = recoveredApp.getState().activeDocumentId;
recoveredApp.getState().closeDocument(initialFreshDocumentId);
if (recoveryShapeOk) {
  const recoveryInputs = loadedRecovery.docs.map(document => recoveryInputFromParsed(
    readIFC(document.ifc),
    { id: document.id, filePath: null, isDirty: true },
  ));
  recoveredApp.getState().restoreDocuments(recoveryInputs, duplicateId);
}
equal('20 recovery restore vervangt de verse lege toestand volledig', {
  count: recoveredApp.getState().documents.length,
  ids: recoveredApp.getState().documents.map(document => document.id),
  activeId: recoveredApp.getState().activeDocumentId,
  freshIdPresent: recoveredApp.getState().documents.some(document => document.id === freshDocumentId),
}, {
  count: expectedRecovery.length,
  ids: expectedRecovery.map(document => document.id),
  activeId: duplicateId,
  freshIdPresent: false,
});
if (recoveryShapeOk) {
  recoveredApp.getState().getOpenDocumentPayloads().forEach((document, index) => {
    equal(`21 recovery restore pinnt bronhandtekening document ${index + 1}`,
      sourceSignature(document.payload), expectedRecovery[index]!.source);
  });
}
await clearRecovery();

// IFC-write en onafhankelijke STEP-inspectie op het herstelde actieve document.
const finalState = recoveryShapeOk ? recoveredApp.getState() : state();
const writtenIfc = writeIFC(buildWriteIFCInput(finalState));
const inspectedIfc = mutant === 'independent-step'
  ? reorderArchiveProperties(writtenIfc)
  : writtenIfc;
const entities = parseStep(inspectedIfc);
const projects = [...entities.values()].filter(entity => entity.type === 'IFCPROJECT');
const archivePsets = psetsNamed(entities, 'OPS_XerSourceArchive');
const selectorPsets = psetsNamed(entities, 'OPS_XerDocument');
equal('22 STEP bevat unieke bronpsets op het bedoelde IFCPROJECT', {
  projects: projects.length,
  archivePsets: archivePsets.length,
  selectorPsets: selectorPsets.length,
  archiveAttachments: archivePsets[0] ? attachedObjectIds(entities, archivePsets[0].id) : [],
  selectorAttachments: selectorPsets[0] ? attachedObjectIds(entities, selectorPsets[0].id) : [],
}, {
  projects: 1,
  archivePsets: 1,
  selectorPsets: 1,
  archiveAttachments: projects[0] ? [projects[0].id] : [],
  selectorAttachments: projects[0] ? [projects[0].id] : [],
});
if (!archivePsets[0] || !selectorPsets[0]) throw new Error('STEP mist bronpropertyset');
const archiveView = psetView(entities, archivePsets[0]);
const selectorView = psetView(entities, selectorPsets[0]);
const expectedArchiveNames = [
  'SchemaVersion', 'Format', 'StorageFormat', 'ByteLength', 'Sha256',
  'ByteChunkSize', 'ByteChunkCount', 'ByteChunk000000', 'ByteChunk000001', 'ByteChunk000002',
];
equal('23 STEP pinnt propertyvolgorde en exact drie chunks', archiveView.names, expectedArchiveNames);
const directChunkValues = expectedArchiveNames.slice(7).map(name => String(archiveView.values[name]));
equal('24 STEP pinnt bronmanifest, chunkvolgorde en selector onafhankelijk', {
  byteLength: archiveView.values.ByteLength,
  sha256: archiveView.values.Sha256,
  chunkCount: archiveView.values.ByteChunkCount,
  chunks: chunkPins(directChunkValues),
  selectorNames: selectorView.names,
  selector: selectorView.values.SourceProjectId,
  selectorDigest: selectorView.values.ArchiveSha256,
}, {
  byteLength: bytes.byteLength,
  sha256: baseline.raw.sha256,
  chunkCount: 3,
  chunks: baseline.raw.chunks,
  selectorNames: ['ArchiveSha256', 'SourceProjectId'],
  selector: 'P-RET',
  selectorDigest: baseline.raw.sha256,
});

const p6Psets = psetsNamed(entities, 'OPS_P6Progress');
const expectedP6Names = [
  'ProjectId', 'TaskId', 'ExplicitTargetWindow', 'CompletePctType',
  'ExpectedFinish', 'DurationType', 'ActivityType', 'SuspendResume',
];
equal('25 STEP bevat voor beide taken exact alle acht P6-properties in vaste volgorde',
  p6Psets.map(pset => psetView(entities, pset).names),
  [expectedP6Names, expectedP6Names]);
const directTaskP6 = p6Psets.map(pset => {
  const view = psetView(entities, pset);
  const attachments = attachedObjectIds(entities, pset.id);
  return {
    attachmentTypes: attachments.map(id => entities.get(id)?.type),
    p6DurationType: view.values.DurationType,
    p6ActivityType: view.values.ActivityType,
    p6ProjectId: view.values.ProjectId,
    p6TaskId: view.values.TaskId,
    p6ExplicitTargetWindow: view.values.ExplicitTargetWindow,
    p6CompletePctType: view.values.CompletePctType,
    p6ExpectedFinish: view.values.ExpectedFinish,
    p6SuspendResume: view.values.SuspendResume,
  };
}).sort((a, b) => String(a.p6TaskId).localeCompare(String(b.p6TaskId)));
equal('26 STEP pinnt alle acht P6-taakwaarden en IFCTASK-attachment',
  directTaskP6,
  expectedP6.taskFields.map(fields => ({ attachmentTypes: ['IFCTASK'], ...fields })));

const calendarPsets = psetsNamed(entities, 'OPS_Calendar');
equal('27 STEP bevat één kalenderpset op IFCWORKCALENDAR', {
  count: calendarPsets.length,
  attachmentTypes: calendarPsets[0]
    ? attachedObjectIds(entities, calendarPsets[0].id).map(id => entities.get(id)?.type)
    : [],
}, { count: 1, attachmentTypes: ['IFCWORKCALENDAR'] });
if (!calendarPsets[0]) throw new Error('STEP mist kalenderpropertyset');
const calendarView = psetView(entities, calendarPsets[0]);
const calendarP6Names = calendarView.names.filter(name => name.startsWith('P6'));
const calendarPenaltyDates = JSON.parse(String(calendarView.values.P6NonWorkPenaltyDates)) as unknown;
equal('28 STEP pinnt kalender-P6-vlaggen en hun volgorde onafhankelijk', {
  names: calendarP6Names,
  p6Source: calendarView.values.P6Source,
  p6NonWorkPenaltyDates: calendarPenaltyDates,
  p6NonWorkPenaltyDatesState:
    calendarView.values.P6Source === 'XER' && Array.isArray(calendarPenaltyDates)
      ? 'VALID_VALUES'
      : 'REJECTED',
}, { names: ['P6Source', 'P6NonWorkPenaltyDates'], ...expectedP6.calendar });

const sequencePsets = psetsNamed(entities, 'OPS_Sequences');
equal('29 STEP bevat één sequence-pset op IFCWORKSCHEDULE', {
  count: sequencePsets.length,
  attachmentTypes: sequencePsets[0]
    ? attachedObjectIds(entities, sequencePsets[0].id).map(id => entities.get(id)?.type)
    : [],
}, { count: 1, attachmentTypes: ['IFCWORKSCHEDULE'] });
if (!sequencePsets[0]) throw new Error('STEP mist sequencepropertyset');
const sequenceView = psetView(entities, sequencePsets[0]);
const boundaryGuids = JSON.parse(String(
  sequenceView.values.P6StartAtPredecessorFinishBoundarySequenceGuids,
)) as unknown;
const relationGuids = [...entities.values()]
  .filter(entity => entity.type === 'IFCRELSEQUENCE')
  .map(entity => ifcString(entity.args[0] ?? ''));
equal('30 STEP pinnt sequence-boundary tegen de echte IFCRELSEQUENCE-GUID',
  boundaryGuids, relationGuids);

// Productreader is een afzonderlijke grens. De mutant blijft geldige STEP en verandert concrete data.
const ifcForReader = mutant === 'ifc-writer-reader'
  ? mutateDurationType(writtenIfc)
  : writtenIfc;
const reloaded = readIFC(ifcForReader);
equal('31 IFC writer/read reconstructie behoudt volledige bronretentie',
  sourceSignature(payloadFromImport(reloaded, null)), baseline);
equal('32 onafhankelijke raw digest blijft gelijk aan originele bronbytes',
  baseline.raw.sha256, sha256Hex(bytes));

if (failures.length === 0) {
  console.log(`OK  xer-source-retention: alle checks groen (${checks})${mutant ? `; mutant=${mutant}` : ''}`);
  process.exit(0);
}
console.log(`XX  xer-source-retention: ${failures.length} inhoudelijke afwijking(en) van ${checks}${mutant ? `; mutant=${mutant}` : ''}`);
for (const failure of failures) console.log(`   - ${failure}`);
process.exit(1);
