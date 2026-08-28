import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assembleXerMultiProjectImport } from '@/services/xer/xerMultiProject';
import type { XerReadResult } from '@/services/xer/xerReader';
import {
  parseXerNumber,
  parseXerTables,
  XerImportError,
  type XerRow,
  type XerTable,
  type XerTables,
} from '@/services/xer/xerTables';
import type { Task } from '@/types/task';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { solveProject } from '@/engine/scheduler/solveProject';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { computeVariance } from '@/engine/variance';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { payloadFromImport } from '@/state/documentContract';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readXerArchiveIFC as readIFC } from './xerArchiveTestReader';
import { XER_SCHEDULING_DEFAULTS } from '@/services/xer/xerScheduleOptions';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function row(line: number, cells: Record<string, string>): XerRow {
  return { line, cells };
}

function table(name: string, rows: XerRow[]): XerTable {
  return {
    name,
    fields: Array.from(new Set(rows.flatMap(item => Object.keys(item.cells)))),
    rows,
  };
}

function tables(projectRows: XerRow[], taskRows: XerRow[]): XerTables {
  return {
    header: { version: 'test', defaultCurrencyCode: 'EUR' },
    tables: new Map([
      ['PROJECT', table('PROJECT', projectRows)],
      ['TASK', table('TASK', taskRows)],
    ]),
    report: { encoding: 'utf-8', endMarkerSeen: true, issues: [], unknownTables: [] },
    numberFormat: { decimal: '.', group: null, source: 'default', currencyCode: 'EUR' },
  };
}

function task(projectId: string, index: number, summary = false): Task {
  const id = `${projectId}-T${index}`;
  return {
    id,
    name: id,
    description: '',
    wbsCode: id,
    taskType: 'CONSTRUCTION',
    status: 'NOT_STARTED',
    isMilestone: false,
    priority: 500,
    parentId: null,
    childIds: summary ? [`${id}-child`] : [],
    ...(summary ? { isSummary: true } : {}),
    time: createDefaultTaskTime(`2026-01-${String(index).padStart(2, '0')}`, 1),
    resourceIds: [],
  };
}

function mappedProject(projectId: string, leaves: number, summaries = 0): XerReadResult {
  const calendar = { ...createDefaultCalendar(), id: `${projectId}-calendar` };
  return {
    project: {
      id: projectId,
      name: `Project ${projectId}`,
      description: '',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      calendarId: calendar.id,
      createdAt: '2026-01-01T00:00:00.000Z',
      modifiedAt: '2026-01-02T00:00:00.000Z',
      author: '',
      company: '',
      progressMode: XER_SCHEDULING_DEFAULTS.progressMode,
      schedulingOptions: structuredClone(XER_SCHEDULING_DEFAULTS.schedulingOptions),
    },
    calendar,
    tasks: [
      ...Array.from({ length: summaries }, (_, index) => task(projectId, index + 20, true)),
      ...Array.from({ length: leaves }, (_, index) => task(projectId, index + 1)),
    ],
    sequences: [],
    resources: [],
    assignments: [],
    xer: {
      defaultCurrencyCode: 'EUR',
      tableReport: { encoding: 'utf-8', endMarkerSeen: true, issues: [], unknownTables: [] },
      calendarIssues: [],
      enumFallbacks: [],
      scheduleOptions: {
        source: 'xer-defaults', retainedSource: {}, fallbacks: [], diagnostics: [],
        sourceArchive: { rows: [], unmatchedScheduleOptionsRowIndexes: [], diagnostics: [] },
        sourceRowIndexes: [], sourceRows: [],
      },
      externalRelations: [],
      externalLinks: [],
      report: {
        projectsSeen: 1,
        documentsOpened: 1,
        emptyProjectsSkipped: 0,
        baselineProjectsExcluded: 0,
        baselinesMaterialized: 0,
        danglingBaselineReferences: 0,
        externalLinksPreserved: 0,
        baselineExclusionReverted: false,
        baselineFallbackReasons: [],
      },
    },
  };
}

// Breuken die dit vangt: export_flag als selector gebruiken, lege projecten als tab openen,
// samenvattingen als bladtaken tellen of het eerste in plaats van het grootste open project kiezen.
const selectionTables = tables([
  row(2, { proj_id: 'P-A', proj_short_name: 'A', export_flag: 'Y' }),
  row(3, { proj_id: 'P-EMPTY', proj_short_name: 'Leeg', export_flag: 'Y' }),
  row(4, { proj_id: 'P-B', proj_short_name: 'B', export_flag: 'N' }),
], [
  row(8, { proj_id: 'P-A', task_id: 'A-1', task_code: 'A-1' }),
  row(9, { proj_id: 'P-A', task_id: 'A-2', task_code: 'A-2' }),
  row(10, { proj_id: 'P-B', task_id: 'B-1', task_code: 'B-1' }),
  row(11, { proj_id: 'P-B', task_id: 'B-2', task_code: 'B-2' }),
  row(12, { proj_id: 'P-B', task_id: 'B-3', task_code: 'B-3' }),
]);
const mapped = new Map([
  ['P-A', mappedProject('P-A', 2, 4)],
  ['P-B', mappedProject('P-B', 3)],
]);
const mappedCalls: string[] = [];
const selection = assembleXerMultiProjectImport(selectionTables, (projectId) => {
  mappedCalls.push(projectId);
  const result = mapped.get(projectId);
  if (!result) throw new Error(`Onverwachte mapperaanroep voor ${projectId}`);
  return result;
});

eq('1 alle niet-lege projecten openen in bronvolgorde; export_flag discrimineert niet',
  selection.documents.map(document => document.projectId), ['P-A', 'P-B']);
eq('2 lege projectrij wordt niet gemapt of geopend', mappedCalls, ['P-A', 'P-B']);
eq('3 actief project telt alleen bladtaken onder werkelijk geopende documenten',
  selection.activeProjectId, 'P-B');
eq('4 selectieverslag telt bronrijen, documenten en lege projecten', selection.report, {
  projectsSeen: 3,
  documentsOpened: 2,
  emptyProjectsSkipped: 1,
  baselineProjectsExcluded: 0,
  baselinesMaterialized: 0,
  danglingBaselineReferences: 0,
  externalLinksPreserved: 0,
  baselineExclusionReverted: false,
  baselineFallbackReasons: [],
});

// Breuk die dit vangt: twee PROJECT-rijen met dezelfde stabiele identiteit als twee documenten
// doorgeven. Daarmee zouden tabselectie, documentboekhouding en latere cross-projectlinks ambigu
// worden; dezelfde duplicate-id-foutvorm als de X4a-identiteitswachten is hier verplicht.
const duplicateProjectTables = tables([
  row(2, { proj_id: 'P-DUP', proj_short_name: 'Eerste' }),
  row(3, { proj_id: 'P-DUP', proj_short_name: 'Tweede' }),
], [
  row(8, { proj_id: 'P-DUP', task_id: 'D-1', task_code: 'D-1' }),
]);
const duplicateProjectCalls: string[] = [];
let duplicateProjectError: unknown;
try {
  assembleXerMultiProjectImport(duplicateProjectTables, (projectId) => {
    duplicateProjectCalls.push(projectId);
    return mappedProject(projectId, 1);
  });
} catch (error) {
  duplicateProjectError = error;
}
eq('4b dubbele PROJECT-identiteit faalt getypeerd voordat de mapper draait', {
  error: duplicateProjectError instanceof XerImportError ? {
    code: duplicateProjectError.xerCode,
    table: duplicateProjectError.table,
    field: duplicateProjectError.field,
    line: duplicateProjectError.line,
    lines: duplicateProjectError.lines,
  } : null,
  mapperCalls: duplicateProjectCalls,
}, {
  error: {
    code: 'XER_DUPLICATE_ID',
    table: 'PROJECT',
    field: 'proj_id',
    line: 3,
    lines: [2, 3],
  },
  mapperCalls: [],
});

// Breuk die dit vangt: een ontbrekend baselineproject als bestaand behandelen, het hoofdproject
// overslaan of de verwijzing stil laten verdwijnen uit het importverslag.
const danglingTables = tables([
  row(2, { proj_id: 'P-MAIN', sum_base_proj_id: 'P-MISSING' }),
  row(3, { proj_id: 'P-OTHER' }),
], [
  row(8, { proj_id: 'P-MAIN', task_id: 'M-1', task_code: 'M-1' }),
  row(9, { proj_id: 'P-OTHER', task_id: 'O-1', task_code: 'O-1' }),
]);
const danglingMapped = new Map([
  ['P-MAIN', mappedProject('P-MAIN', 1)],
  ['P-OTHER', mappedProject('P-OTHER', 1)],
]);
const dangling = assembleXerMultiProjectImport(danglingTables, (projectId) => {
  const result = danglingMapped.get(projectId);
  if (!result) throw new Error(`Onverwachte mapperaanroep voor ${projectId}`);
  return result;
});
eq('5 dangling baselineverwijzing wordt genegeerd en geteld', {
  documents: dangling.documents.map(document => document.projectId),
  dangling: dangling.report.danglingBaselineReferences,
  excluded: dangling.report.baselineProjectsExcluded,
  baselines: dangling.report.baselinesMaterialized,
}, {
  documents: ['P-MAIN', 'P-OTHER'],
  dangling: 1,
  excluded: 0,
  baselines: 0,
});

function identifiedTask(
  projectId: string,
  id: string,
  code: string,
  start: string,
  finish: string,
): Task {
  const value = task(projectId, 1);
  return {
    ...value,
    id,
    name: `Taak ${id}`,
    wbsCode: code,
    time: {
      ...value.time,
      scheduleStart: start,
      scheduleFinish: finish,
      earlyStart: start,
      earlyFinish: finish,
    },
  };
}

// Breuken die dit vangt: het aanwezige baselineproject als tweede document openen, alleen een naam
// bewaren, op array-index koppelen of een baseline-only taak stil weggooien.
const baselineTables = tables([
  row(2, { proj_id: 'P-MAIN', sum_base_proj_id: 'P-BASE' }),
  row(3, { proj_id: 'P-BASE' }),
], [
  row(8, { proj_id: 'P-MAIN', task_id: 'M-SAME-ID', task_code: 'CODE-ID' }),
  row(9, { proj_id: 'P-MAIN', task_id: 'M-CODE', task_code: 'CODE-MATCH' }),
  row(10, { proj_id: 'P-MAIN', task_id: 'M-NEW', task_code: 'CODE-NEW' }),
  row(11, { proj_id: 'P-BASE', task_id: 'M-SAME-ID', task_code: 'CODE-ID-OLD' }),
  row(12, { proj_id: 'P-BASE', task_id: 'B-CODE', task_code: 'CODE-MATCH' }),
  row(13, { proj_id: 'P-BASE', task_id: 'B-OLD', task_code: 'CODE-OLD' }),
]);
const mainResult = mappedProject('P-MAIN', 0);
mainResult.tasks = [
  identifiedTask('P-MAIN', 'M-SAME-ID', 'CODE-ID', '2026-05-01', '2026-05-02'),
  identifiedTask('P-MAIN', 'M-CODE', 'CODE-MATCH', '2026-05-03', '2026-05-04'),
  identifiedTask('P-MAIN', 'M-NEW', 'CODE-NEW', '2026-05-05', '2026-05-06'),
];
const baselineResult = mappedProject('P-BASE', 0);
baselineResult.tasks = [
  identifiedTask('P-BASE', 'M-SAME-ID', 'CODE-ID-OLD', '2026-04-01', '2026-04-02'),
  identifiedTask('P-BASE', 'B-CODE', 'CODE-MATCH', '2026-04-03', '2026-04-04'),
  identifiedTask('P-BASE', 'B-OLD', 'CODE-OLD', '2026-04-05', '2026-04-06'),
];
const baselineMapped = new Map([
  ['P-MAIN', mainResult],
  ['P-BASE', baselineResult],
]);
const baselineImport = assembleXerMultiProjectImport(baselineTables, (projectId) => {
  const result = baselineMapped.get(projectId);
  if (!result) throw new Error(`Onverwachte mapperaanroep voor ${projectId}`);
  return result;
});
const importedBaseline = baselineImport.documents[0]?.result.baselines?.[0];
eq('6 aanwezig baselineproject wordt één echte actieve OPS-baseline, geen document', {
  documents: baselineImport.documents.map(document => document.projectId),
  baselineId: importedBaseline?.id,
  activeBaselineId: baselineImport.documents[0]?.result.activeBaselineId,
  name: importedBaseline?.name,
  excluded: baselineImport.report.baselineProjectsExcluded,
  materialized: baselineImport.report.baselinesMaterialized,
}, {
  documents: ['P-MAIN'],
  baselineId: 'xer-baseline:P-MAIN:P-BASE',
  activeBaselineId: 'xer-baseline:P-MAIN:P-BASE',
  name: 'Project P-BASE',
  excluded: 1,
  materialized: 1,
});
eq('7 baseline koppelt id/code onafhankelijk en bewaart een baseline-only taak',
  importedBaseline?.tasks.map(item => ({
    taskId: item.taskId,
    sourceTaskId: item.sourceTaskId,
    sourceTaskCode: item.sourceTaskCode,
    start: item.start,
    finish: item.finish,
  })), [
    { taskId: 'M-SAME-ID', sourceTaskId: 'M-SAME-ID', sourceTaskCode: 'CODE-ID-OLD', start: '2026-04-01', finish: '2026-04-02' },
    { taskId: 'M-CODE', sourceTaskId: 'B-CODE', sourceTaskCode: 'CODE-MATCH', start: '2026-04-03', finish: '2026-04-04' },
    { taskId: 'B-OLD', sourceTaskId: 'B-OLD', sourceTaskCode: 'CODE-OLD', start: '2026-04-05', finish: '2026-04-06' },
  ]);
eq('7a baseline bewaart de uitgesloten bronprojectidentiteit naast de ownerkoppeling',
  importedBaseline?.sourceProjectId, 'P-BASE');
eq('7b baseline-materialisatie muteert de geïnjecteerde X4a-resultaten niet', {
  baselines: mainResult.baselines,
  activeBaselineId: mainResult.activeBaselineId,
}, { baselines: undefined, activeBaselineId: undefined });
const syntheticBaselinePayload = payloadFromImport(baselineImport.documents[0].result, null);
const syntheticVariance = computeVariance(
  syntheticBaselinePayload.tasks,
  syntheticBaselinePayload.baselines.find(
    item => item.id === syntheticBaselinePayload.activeBaselineId,
  ) ?? null,
  new CalendarEngine(syntheticBaselinePayload.calendar),
  '2026-05-06',
);
eq('7b1 synthetische baseline werkt direct via documentcontract en normaal variancepad', {
  baselines: syntheticBaselinePayload.baselines.length,
  active: syntheticBaselinePayload.activeBaselineId,
  rows: syntheticVariance.rows.map(item => [item.taskId, item.status]),
}, {
  baselines: 1,
  active: 'xer-baseline:P-MAIN:P-BASE',
  rows: [
    ['M-SAME-ID', 'late'],
    ['M-CODE', 'late'],
    ['M-NEW', 'new'],
    ['B-OLD', 'dropped'],
  ],
});
const syntheticRoundTrip = readIFC(writeIFC(baselineImport.documents[0].result));
const roundTrippedTaskByCode = new Map(
  syntheticRoundTrip.tasks.map(item => [item.wbsCode, item.id]),
);
const roundTrippedBaselineTasks = syntheticRoundTrip.baselines?.[0]?.tasks ?? [];
const roundTrippedPayload = payloadFromImport(syntheticRoundTrip, null);
const roundTrippedVariance = computeVariance(
  roundTrippedPayload.tasks,
  roundTrippedPayload.baselines.find(
    item => item.id === roundTrippedPayload.activeBaselineId,
  ) ?? null,
  new CalendarEngine(roundTrippedPayload.calendar),
  '2026-05-06',
);
eq('7b2 synthetische baseline round-tript met identificatie en datums door IFC', {
  active: syntheticRoundTrip.activeBaselineId,
  currentTaskLinks: [
    roundTrippedBaselineTasks[0]?.taskId === roundTrippedTaskByCode.get('CODE-ID'),
    roundTrippedBaselineTasks[1]?.taskId === roundTrippedTaskByCode.get('CODE-MATCH'),
  ],
  baselineOnlyTaskId: roundTrippedBaselineTasks[2]?.taskId,
  dates: roundTrippedBaselineTasks.map(item => ({
    start: item.start,
    finish: item.finish,
  })),
  variance: roundTrippedVariance.rows.map(item => item.status),
}, {
  active: 'xer-baseline:P-MAIN:P-BASE',
  currentTaskLinks: [true, true],
  baselineOnlyTaskId: 'B-OLD',
  dates: [
    { start: '2026-04-01', finish: '2026-04-02' },
    { start: '2026-04-03', finish: '2026-04-04' },
    { start: '2026-04-05', finish: '2026-04-06' },
  ],
  variance: ['late', 'late', 'new', 'dropped'],
});

// Breuk die dit vangt: een aanwezige baseline-PROJECT-rij zonder TASK-rij stil als dangling
// behandelen of hem via de X4a-mapper alsnog als leeg project proberen te openen.
const emptyBaselineTables = tables([
  row(2, { proj_id: 'P-MAIN', sum_base_proj_id: 'P-EMPTY-BASE' }),
  row(3, { proj_id: 'P-EMPTY-BASE', proj_short_name: 'Lege baseline' }),
], [
  row(8, { proj_id: 'P-MAIN', task_id: 'M-1', task_code: 'M-1' }),
]);
const emptyBaselineCalls: string[] = [];
const emptyBaselineImport = assembleXerMultiProjectImport(emptyBaselineTables, (projectId) => {
  emptyBaselineCalls.push(projectId);
  if (projectId !== 'P-MAIN') throw new Error(`Onverwachte mapperaanroep voor ${projectId}`);
  return mappedProject(projectId, 1);
});
eq('7c aanwezige lege baseline wordt gematerialiseerd zonder lege tab of mapperaanroep', {
  documents: emptyBaselineImport.documents.map(document => document.projectId),
  mapperCalls: emptyBaselineCalls,
  emptySkipped: emptyBaselineImport.report.emptyProjectsSkipped,
  dangling: emptyBaselineImport.report.danglingBaselineReferences,
  materialized: emptyBaselineImport.report.baselinesMaterialized,
  baselineName: emptyBaselineImport.documents[0]?.result.baselines?.[0]?.name,
  baselineTasks: emptyBaselineImport.documents[0]?.result.baselines?.[0]?.tasks,
}, {
  documents: ['P-MAIN'],
  mapperCalls: ['P-MAIN'],
  emptySkipped: 1,
  dangling: 0,
  materialized: 1,
  baselineName: 'Lege baseline',
  baselineTasks: [],
});

/**
 * Synthetische vangrailfixtures. Zonder het terugnemen van baseline-uitsluiting wordt SELF door
 * zijn eigen verwijzing uitgesloten en sluiten A/B elkaar in de cyclus wederzijds uit: beide
 * fixtures zouden dan nul documenten opleveren. De extra C in de cycluscase bewijst bovendien dat
 * een echte cyclus de uitsluiting voor het hele bestand terugneemt, niet alleen bij exact nul.
 */
function guardFixture(kind: 'self' | 'cycle'): {
  tables: XerTables;
  mapped: Map<string, XerReadResult>;
} {
  if (kind === 'self') {
    return {
      tables: tables([
        row(2, { proj_id: 'P-SELF', sum_base_proj_id: 'P-SELF' }),
      ], [
        row(8, { proj_id: 'P-SELF', task_id: 'S-1', task_code: 'S-1' }),
      ]),
      mapped: new Map([['P-SELF', mappedProject('P-SELF', 1)]]),
    };
  }
  return {
    tables: tables([
      row(2, { proj_id: 'P-A', sum_base_proj_id: 'P-B' }),
      row(3, { proj_id: 'P-B', sum_base_proj_id: 'P-A' }),
      row(4, { proj_id: 'P-C' }),
    ], [
      row(8, { proj_id: 'P-A', task_id: 'A-1', task_code: 'A-1' }),
      row(9, { proj_id: 'P-B', task_id: 'B-1', task_code: 'B-1' }),
      row(10, { proj_id: 'P-C', task_id: 'C-1', task_code: 'C-1' }),
    ]),
    mapped: new Map([
      ['P-A', mappedProject('P-A', 1)],
      ['P-B', mappedProject('P-B', 1)],
      ['P-C', mappedProject('P-C', 1)],
    ]),
  };
}

function assembleGuardFixture(kind: 'self' | 'cycle') {
  const fixture = guardFixture(kind);
  return assembleXerMultiProjectImport(fixture.tables, (projectId) => {
    const result = fixture.mapped.get(projectId);
    if (!result) throw new Error(`Onverwachte mapperaanroep voor ${projectId}`);
    return result;
  });
}

const selfGuard = assembleGuardFixture('self');
eq('8 zelfverwijzing neemt baseline-uitsluiting terug en opent nooit nul documenten', {
  documents: selfGuard.documents.map(document => document.projectId),
  baselines: selfGuard.report.baselinesMaterialized,
  reverted: selfGuard.report.baselineExclusionReverted,
  reasons: selfGuard.report.baselineFallbackReasons,
}, {
  documents: ['P-SELF'],
  baselines: 0,
  reverted: true,
  reasons: ['self-reference', 'all-projects-baselines'],
});

const cycleGuard = assembleGuardFixture('cycle');
eq('9 cyclus neemt uitsluiting voor het hele bestand terug, ook als C open zou blijven', {
  documents: cycleGuard.documents.map(document => document.projectId),
  baselines: cycleGuard.report.baselinesMaterialized,
  reverted: cycleGuard.report.baselineExclusionReverted,
  reasons: cycleGuard.report.baselineFallbackReasons,
}, {
  documents: ['P-A', 'P-B', 'P-C'],
  baselines: 0,
  reverted: true,
  reasons: ['cycle'],
});

// Reviewronde 1, P1: een PROJECT-rij zonder taken wordt niet geopend en kan daarom ook geen
// baseline-eigenaar zijn. Zijn sum_base_proj_id mag een niet-leeg bronproject niet uit de openlijst
// drukken. Het derde, niet-lege project voorkomt dat de algemene alles-uitgesloten-vangrail deze
// fout maskeert: de oude implementatie opende alleen P-THIRD en verloor P-BASE volledig.
const emptyOwnerTables = tables([
  row(2, { proj_id: 'P-BASE' }),
  row(3, { proj_id: 'P-EMPTY-OWNER', sum_base_proj_id: 'P-BASE' }),
  row(4, { proj_id: 'P-THIRD' }),
], [
  row(8, { proj_id: 'P-BASE', task_id: 'B-1', task_code: 'B-1' }),
  row(9, { proj_id: 'P-THIRD', task_id: 'T-1', task_code: 'T-1' }),
]);
const emptyOwnerImport = assembleXerMultiProjectImport(
  emptyOwnerTables,
  projectId => mappedProject(projectId, 1),
);
eq('9a lege baseline-eigenaar sluit een niet-leeg bronproject nooit uit', {
  documents: emptyOwnerImport.documents.map(document => document.projectId),
  empty: emptyOwnerImport.report.emptyProjectsSkipped,
  excluded: emptyOwnerImport.report.baselineProjectsExcluded,
  baselines: emptyOwnerImport.report.baselinesMaterialized,
  reverted: emptyOwnerImport.report.baselineExclusionReverted,
  reasons: emptyOwnerImport.report.baselineFallbackReasons,
}, {
  documents: ['P-BASE', 'P-THIRD'],
  empty: 1,
  excluded: 0,
  baselines: 0,
  reverted: false,
  reasons: [],
});

// Breuk die dit vangt: de baselinegraaf recursief aflopen. Een groot maar geldig bestand met een
// lange acyclische keten mag niet op de JavaScript-callstack stuklopen voordat selectie begint.
const deepProjectCount = 12_000;
const deepProjectRows = Array.from({ length: deepProjectCount }, (_, index) => row(
  index + 2,
  {
    proj_id: `P-DEEP-${index}`,
    ...(index + 1 < deepProjectCount
      ? { sum_base_proj_id: `P-DEEP-${index + 1}` }
      : {}),
  },
));
const deepTables = tables(deepProjectRows, [
  row(deepProjectCount + 3, {
    proj_id: 'P-DEEP-0', task_id: 'DEEP-1', task_code: 'DEEP-1',
  }),
]);
let deepImport: ReturnType<typeof assembleXerMultiProjectImport> | undefined;
let deepError: unknown;
try {
  deepImport = assembleXerMultiProjectImport(
    deepTables,
    projectId => mappedProject(projectId, 1),
  );
} catch (error) {
  deepError = error;
}
eq('9b diepe acyclische baselineketen blijft stackveilig en opent het hoofdproject', {
  error: deepError instanceof Error ? deepError.name : deepError ?? null,
  documents: deepImport?.documents.map(document => document.projectId),
  baselines: deepImport?.report.baselinesMaterialized,
  reverted: deepImport?.report.baselineExclusionReverted,
}, {
  error: null,
  documents: ['P-DEEP-0'],
  baselines: 1,
  reverted: false,
});

// Breuken die dit vangt: beide lokale perspectieven als twee links tellen, een cross-projectrand
// als lokale Sequence toevoegen of hem als Task.externalLinks alsnog de solver in laten lekken.
const linkTables = tables([
  row(2, { proj_id: 'P-LINK-A' }),
  row(3, { proj_id: 'P-LINK-B' }),
], [
  row(8, { proj_id: 'P-LINK-A', task_id: 'LA', task_code: 'LA' }),
  row(9, { proj_id: 'P-LINK-B', task_id: 'LB', task_code: 'LB' }),
]);
const linkA = mappedProject('P-LINK-A', 0);
linkA.tasks = [identifiedTask('P-LINK-A', 'LA', 'LA', '2026-01-01', '2026-01-10')];
linkA.xer.externalRelations = [{
  id: 'R-CROSS',
  localProjectId: 'P-LINK-A',
  localTaskId: 'LA',
  externalProjectId: 'P-LINK-B',
  externalTaskId: 'LB',
  direction: 'successor',
  type: 'FS',
  lagMinutes: 0,
}];
const linkB = mappedProject('P-LINK-B', 0);
linkB.tasks = [identifiedTask('P-LINK-B', 'LB', 'LB', '2026-01-02', '2026-01-03')];
linkB.xer.externalRelations = [{
  id: 'R-CROSS',
  localProjectId: 'P-LINK-B',
  localTaskId: 'LB',
  externalProjectId: 'P-LINK-A',
  externalTaskId: 'LA',
  direction: 'predecessor',
  type: 'FS',
  lagMinutes: 0,
}];
const linkMapped = new Map([
  ['P-LINK-A', linkA],
  ['P-LINK-B', linkB],
]);
const linkImport = assembleXerMultiProjectImport(linkTables, (projectId) => {
  const result = linkMapped.get(projectId);
  if (!result) throw new Error(`Onverwachte mapperaanroep voor ${projectId}`);
  return result;
});
eq('10 twee lokale perspectieven worden één solverloze externalLink tussen documenten', {
  links: linkImport.externalLinks,
  reportCount: linkImport.report.externalLinksPreserved,
  sequences: linkImport.documents.map(document => document.result.sequences.length),
  taskLinks: linkImport.documents.map(document =>
    document.result.tasks.flatMap(item => item.externalLinks ?? []).length),
}, {
  links: [{
    id: 'R-CROSS',
    predecessor: { projectId: 'P-LINK-A', taskId: 'LA' },
    successor: { projectId: 'P-LINK-B', taskId: 'LB' },
    type: 'FS',
    lagMinutes: 0,
  }],
  reportCount: 1,
  sequences: [0, 0],
  taskLinks: [0, 0],
});
eq('10a iedere betrokken documentpayload draagt exact dezelfde gededupliceerde bronlink',
  linkImport.documents.map(document => ({
    projectId: document.projectId,
    links: document.result.xer.externalLinks,
  })), [
    { projectId: 'P-LINK-A', links: linkImport.externalLinks },
    { projectId: 'P-LINK-B', links: linkImport.externalLinks },
  ]);
const solvedLinkB = solveProject({
  tasks: linkImport.documents[1].result.tasks.map(item => ({ ...item, time: { ...item.time } })),
  sequences: linkImport.documents[1].result.sequences,
  calendar: linkImport.documents[1].result.calendar,
  calendars: linkImport.documents[1].result.resourceCalendars ?? [],
});
eq('11 cross-projectlink stuurt de losse documentsolve niet',
  solvedLinkB.tasks.get('LB')?.earlyStart, '2026-01-02');

// Breuk die dit vangt: mapperresultaten rechtstreeks doorgeven of één gedeelde array/object na
// payloadFromImport tussen twee geopende documenten laten bestaan.
const isolationTables = tables([
  row(2, { proj_id: 'P-ISO-A' }),
  row(3, { proj_id: 'P-ISO-B' }),
], [
  row(8, { proj_id: 'P-ISO-A', task_id: 'IA', task_code: 'IA' }),
  row(9, { proj_id: 'P-ISO-B', task_id: 'IB', task_code: 'IB' }),
]);
const isolationA = mappedProject('P-ISO-A', 1);
const isolationB = mappedProject('P-ISO-B', 1);
const sharedResources = [{
  id: 'R-SHARED', name: 'Gedeelde invoer', type: 'LABOR' as const, description: '', maxUnits: 1,
}];
isolationA.resources = sharedResources;
isolationB.resources = sharedResources;
const isolationMapped = new Map([
  ['P-ISO-A', isolationA],
  ['P-ISO-B', isolationB],
]);
const isolationImport = assembleXerMultiProjectImport(isolationTables, (projectId) => {
  const result = isolationMapped.get(projectId);
  if (!result) throw new Error(`Onverwachte mapperaanroep voor ${projectId}`);
  return result;
});
const isolationDocA = isolationImport.documents[0].result;
const isolationDocB = isolationImport.documents[1].result;
const isolationPayloadA = payloadFromImport(isolationDocA, null);
const isolationPayloadB = payloadFromImport(isolationDocB, null);
isolationPayloadA.tasks[0].name = 'Alleen A gewijzigd';
isolationPayloadA.resources[0].name = 'Alleen A-resource';
eq('12 elk documentresultaat/payload is losstaand van bron en buurdocument', {
  resultDetached: isolationDocA !== isolationA,
  tasksDetached: isolationDocA.tasks !== isolationA.tasks,
  sharedInputSplit: isolationDocA.resources !== isolationDocB.resources,
  sourceTaskName: isolationA.tasks[0].name,
  sourceResourceName: sharedResources[0].name,
  otherTaskName: isolationPayloadB.tasks[0].name,
  otherResourceName: isolationPayloadB.resources[0].name,
}, {
  resultDetached: true,
  tasksDetached: true,
  sharedInputSplit: true,
  sourceTaskName: 'P-ISO-A-T1',
  sourceResourceName: 'Gedeelde invoer',
  otherTaskName: 'P-ISO-B-T1',
  otherResourceName: 'Gedeelde invoer',
});

interface CorpusManifest {
  files: Record<string, { sha256: string }>;
}

function corpusBytes(hash: string): Uint8Array | null {
  const root = process.env.OPS_XER_CORPUS;
  if (!root) return null;
  if (!existsSync(root)) {
    diffs.push('OPS_XER_CORPUS wijst niet naar een bestaande openbare corpusmap');
    return null;
  }
  const manifest = JSON.parse(
    readFileSync(join(import.meta.dirname, 'xer-corpus-manifest.json'), 'utf8'),
  ) as CorpusManifest;
  const relativePath = Object.entries(manifest.files)
    .find(([, entry]) => entry.sha256 === hash)?.[0];
  if (!relativePath) {
    diffs.push(`openbare XER-hash ${hash.slice(0, 16)} ontbreekt in het manifest`);
    return null;
  }
  try {
    const bytes = new Uint8Array(readFileSync(join(root, relativePath)));
    eq(`openbare hash ${hash.slice(0, 16)} is byte-identiek`,
      createHash('sha256').update(bytes).digest('hex'), hash);
    return bytes;
  } catch {
    diffs.push(`openbare XER-hash ${hash.slice(0, 16)} kon niet worden gelezen`);
    return null;
  }
}

function normalizeSourceDate(raw: string | undefined, fallback: string): string {
  const value = raw?.trim();
  return value ? value.replace(' ', 'T') : fallback;
}

/** Testadapter voor het seriële wiring-venster: minimale X4a-vorm uit echte X2-tabellen. */
function mapCorpusProject(source: XerTables, projectId: string): XerReadResult {
  const projectRow = source.tables.get('PROJECT')?.rows
    .find(item => item.cells.proj_id === projectId);
  if (!projectRow) throw new Error('Openbare testadapter mist een gevraagde projectrij');
  const taskRows = (source.tables.get('TASK')?.rows ?? [])
    .filter(item => item.cells.proj_id === projectId);
  const fallbackStart = normalizeSourceDate(projectRow.cells.last_recalc_date, '1970-01-01');
  const tasks = taskRows.map((item, index): Task => {
    const start = normalizeSourceDate(item.cells.target_start_date, fallbackStart);
    const finish = normalizeSourceDate(item.cells.target_end_date, start);
    const durationHours = parseXerNumber(
      item.cells.target_drtn_hr_cnt ?? '', source.numberFormat,
    ) ?? 0;
    const mapped = task(projectId, index + 1);
    return {
      ...mapped,
      id: item.cells.task_id,
      name: item.cells.task_name || item.cells.task_code,
      wbsCode: item.cells.task_code,
      time: {
        ...mapped.time,
        scheduleDuration: durationHours / 8,
        scheduleStart: start,
        scheduleFinish: finish,
        earlyStart: start,
        earlyFinish: finish,
        lateStart: start,
        lateFinish: finish,
      },
    };
  });
  const starts = tasks.map(item => item.time.scheduleStart).sort();
  const finishes = tasks.map(item => item.time.scheduleFinish).sort();
  const calendar = { ...createDefaultCalendar(), id: projectRow.cells.clndr_id || `${projectId}-cal` };
  return {
    project: {
      id: projectId,
      name: projectRow.cells.proj_short_name || projectId,
      description: '',
      startDate: starts[0] ?? fallbackStart,
      endDate: finishes[finishes.length - 1] ?? fallbackStart,
      calendarId: calendar.id,
      createdAt: fallbackStart,
      modifiedAt: fallbackStart,
      author: '',
      company: '',
      progressMode: XER_SCHEDULING_DEFAULTS.progressMode,
      schedulingOptions: structuredClone(XER_SCHEDULING_DEFAULTS.schedulingOptions),
    },
    calendar,
    tasks,
    sequences: [],
    resources: [],
    assignments: [],
    xer: {
      defaultCurrencyCode: source.header.defaultCurrencyCode,
      tableReport: source.report,
      calendarIssues: [],
      enumFallbacks: [],
      scheduleOptions: {
        source: 'xer-defaults', retainedSource: {}, fallbacks: [], diagnostics: [],
        sourceArchive: { rows: [], unmatchedScheduleOptionsRowIndexes: [], diagnostics: [] },
        sourceRowIndexes: [], sourceRows: [],
      },
      externalRelations: [],
      externalLinks: [],
      report: {
        projectsSeen: 1,
        documentsOpened: 1,
        emptyProjectsSkipped: 0,
        baselineProjectsExcluded: 0,
        baselinesMaterialized: 0,
        danglingBaselineReferences: 0,
        externalLinksPreserved: 0,
        baselineExclusionReverted: false,
        baselineFallbackReasons: [],
      },
    },
  };
}

const multiProjectHash = '2bc12241c3f8ee5b7472dd0e77f2cbffafcf3b5438b17022fd9db4f4c642d4b0';
const multiProjectBytes = corpusBytes(multiProjectHash);
if (multiProjectBytes) {
  const heapBefore = process.memoryUsage().heapUsed;
  const started = performance.now();
  const corpusTables = parseXerTables(multiProjectBytes);
  const corpusImport = assembleXerMultiProjectImport(
    corpusTables,
    projectId => mapCorpusProject(corpusTables, projectId),
  );
  const elapsedMs = performance.now() - started;
  const heapDeltaBytes = process.memoryUsage().heapUsed - heapBefore;
  eq('13 openbare 15-projectenhash opent 12 documenten en telt lege/dangling rijen', {
    projects: corpusImport.report.projectsSeen,
    documents: corpusImport.report.documentsOpened,
    empty: corpusImport.report.emptyProjectsSkipped,
    dangling: corpusImport.report.danglingBaselineReferences,
    excluded: corpusImport.report.baselineProjectsExcluded,
  }, {
    projects: 15,
    documents: 12,
    empty: 3,
    dangling: 9,
    excluded: 0,
  });
  const leafCounts = corpusImport.documents.map(document => document.result.tasks.length);
  const activeLeafCount = corpusImport.documents
    .find(document => document.projectId === corpusImport.activeProjectId)?.result.tasks.length;
  eq('14 openbare actieve selectie heeft de meeste bladtaken onder geopende documenten',
    activeLeafCount, Math.max(...leafCounts));
  eq('15 openbare kernmeting levert eindige tijd en heapdelta', {
    elapsedFinite: Number.isFinite(elapsedMs),
    heapFinite: Number.isFinite(heapDeltaBytes),
  }, { elapsedFinite: true, heapFinite: true });
  console.log(
    `.   X4b-kernmeting hash=${multiProjectHash.slice(0, 16)} documenten=${corpusImport.documents.length} `
    + `elapsedMs=${elapsedMs.toFixed(1)} heapDeltaBytes=${heapDeltaBytes}`,
  );
} else {
  console.log('OK  XER-multi-project: openbare 15-projectenpin overgeslagen (OPS_XER_CORPUS)');
}

const baselineCorpusHash = '1ba69d297ee9a5c65c644e7373dc414aa334c996b74800c4688aea7e3681eebf';
const baselineCorpusBytes = corpusBytes(baselineCorpusHash);
if (baselineCorpusBytes) {
  const corpusTables = parseXerTables(baselineCorpusBytes);
  const corpusImport = assembleXerMultiProjectImport(
    corpusTables,
    projectId => mapCorpusProject(corpusTables, projectId),
  );
  const document = corpusImport.documents[0]?.result;
  const baseline = document?.baselines?.[0];
  const currentIds = new Set(document?.tasks.map(item => item.id) ?? []);
  eq('16 openbare baselinehash levert één document met één actieve echte baseline', {
    documents: corpusImport.documents.length,
    baselines: document?.baselines?.length,
    active: document?.activeBaselineId === baseline?.id,
    baselineTasks: baseline?.tasks.length,
    matchedTasks: baseline?.tasks.filter(item => currentIds.has(item.taskId)).length,
    baselineOnlyTasks: baseline?.tasks.filter(item => !currentIds.has(item.taskId)).length,
  }, {
    documents: 1,
    baselines: 1,
    active: true,
    baselineTasks: 4,
    matchedTasks: 3,
    baselineOnlyTasks: 1,
  });
  if (document && baseline) {
    const payload = payloadFromImport(document, null);
    const variance = computeVariance(
      payload.tasks,
      payload.baselines.find(item => item.id === payload.activeBaselineId) ?? null,
      new CalendarEngine(payload.calendar),
      payload.project.endDate,
    );
    eq('17 openbare baseline werkt via normaal documentcontract en variancepad', {
      payloadBaselines: payload.baselines.length,
      active: payload.activeBaselineId === baseline.id,
      rows: variance.rows.length,
      newRows: variance.rows.filter(item => item.status === 'new').length,
      droppedRows: variance.rows.filter(item => item.status === 'dropped').length,
    }, {
      payloadBaselines: 1,
      active: true,
      rows: 5,
      newRows: 1,
      droppedRows: 1,
    });
    const roundTripped = readIFC(writeIFC(document));
    eq('18 openbare baseline round-tript door het bestaande IFC-contract', {
      baselines: roundTripped.baselines?.length,
      active: roundTripped.activeBaselineId === baseline.id,
      tasks: roundTripped.baselines?.[0]?.tasks.length,
      datesFilled: roundTripped.baselines?.[0]?.tasks.every(item => !!item.start && !!item.finish),
    }, {
      baselines: 1,
      active: true,
      tasks: 4,
      datesFilled: true,
    });
  }
} else {
  console.log('OK  XER-multi-project: openbare baselinepin overgeslagen (OPS_XER_CORPUS)');
}

if (diffs.length > 0) {
  console.error(`XER-multi-project: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK  XER-multi-project: ${checks} selectiechecks groen`);
