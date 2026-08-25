/**
 * X6-contract: de lezer projecteert P6-resources/toewijzingen zonder de bestandsbrede bronrijen
 * te kopiëren. Breuken die dit vangt: TASKRSRC negeren, resource/rol-id's mengen, material-rate
 * als percentage interpreteren, curvepunten weggooien, of mutable parserrijen delen.
 */
import { readXER } from '@/services/xer/xerReader';
import { parseXerTables } from '@/services/xer/xerTables';
import { isMultiDocumentImport } from '@/services/importTypes';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function bytes(lines: readonly string[]): Uint8Array {
  return new TextEncoder().encode(lines.join('\n'));
}

const curveFields = Array.from({ length: 21 }, (_, index) => `pct_usage_${index}`);
const bell = [
  20, 28, 36, 44, 52, 60, 68, 76, 84, 92, 100,
  92, 84, 76, 68, 60, 52, 44, 36, 28, 20,
];
const fixture = bytes([
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tdef_duration_type\tlast_recalc_date',
  '%R\tP1\tX6 Project\tCP\tDT_FixedDUR2\t2026-01-01',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tclndr_data',
  '%R\tCP\tProject\tCA_Project\t8\t',
  '%R\tCR\tResource\tCA_Rsrc\t10\t',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\ttask_name\ttask_code\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\ttask_type\tstatus_code',
  '%R\tT1\tP1\tMetselen\tA1\t2026-01-01\t2026-01-02\t8\tTT_Task\tTK_NotStart',
  '%R\tT2\tP1\tOntwerp\tA2\t2026-01-01\t2026-01-02\t8\tTT_Task\tTK_NotStart',
  '%T\tUMEASURE',
  '%F\tunit_id\tunit_abbrev',
  '%R\tU-KG\tkg',
  '%T\tROLES',
  '%F\trole_id\trole_name',
  '%R\t42\tOntwerper',
  '%T\tRSRC',
  '%F\trsrc_id\trsrc_name\trsrc_type\tclndr_id\tdef_qty_per_hr\tunit_id\trole_id',
  '%R\t42\tVakman\tRT_Labor\tCR\t2\t\t42',
  '%R\tMAT\tMortel\tRT_Mat\tCR\t40\tU-KG\t',
  '%T\tRSRCRATE',
  '%F\trsrc_rate_id\trsrc_id\tmax_qty_per_hr\tcost_per_qty\tstart_date',
  '%R\tR-1\t42\t1\t25\t2026-01-01 00:00',
  '%R\tR-2\tMAT\t50\t4.5\t2026-01-01 00:00',
  '%T\tRSRCCURVDATA',
  `%F\tcurv_id\tcurv_name\t${curveFields.join('\t')}`,
  `%R\tC-BELL\tKlok\t${bell.join('\t')}`,
  '%T\tTASKRSRC',
  '%F\ttaskrsrc_id\tproj_id\ttask_id\trsrc_id\trole_id\ttarget_qty_per_hr\tremain_qty_per_hr\tremain_qty\ttarget_qty\tcurv_id\ttarget_crv\tremain_crv\tactual_crv\tcost_per_qty\ttarget_cost\tremain_cost',
  '%R\tA-LABOR\tP1\tT1\t42\t42\t0.5\t0.5\t4\t5\tC-BELL\tTC\tRC\tAC\t25\t125\t100',
  '%R\tA-MATERIAL\tP1\tT2\tMAT\t\t3\t3\t18\t24\t\t\t\t\t4\t96\t72',
  '%E',
]);

const parsed = parseXerTables(fixture);
const taskRow = parsed.tables.get('TASK')?.rows[0];
eq('X6-a parser bevries gedeelde TASKRSRC- en taakbronrijen', {
  row: taskRow ? Object.isFrozen(taskRow) : false,
  cells: taskRow ? Object.isFrozen(taskRow.cells) : false,
}, { row: true, cells: true });

const opened = readXER(fixture);
if (isMultiDocumentImport(opened)) {
  diffs.push('X6-b enkelproject-fixture mag niet als multi-documentresultaat terugkomen');
} else {
  eq('X6-b RSRC projecteert kalender, rates en rollen in gescheiden naamruimten',
    opened.resources.map(resource => ({
      id: resource.id,
      type: resource.type,
      calendarId: resource.calendarId,
      maxUnits: resource.maxUnits,
      unitOfMeasure: resource.unitOfMeasure,
      costPerHour: resource.costPerHour,
      availabilitySteps: resource.availabilitySteps,
    })), [
      {
        id: 'xer-resource:42', type: 'LABOR', calendarId: 'CR', maxUnits: 2,
        costPerHour: 25, availabilitySteps: [{ from: '2026-01-01', maxUnits: 1 }],
      },
      {
        id: 'xer-resource:MAT', type: 'MATERIAL', calendarId: 'CR', maxUnits: 40,
        unitOfMeasure: 'kg', costPerHour: 4.5, availabilitySteps: [{ from: '2026-01-01', maxUnits: 50 }],
      },
    ]);
  eq('X6-c TASKRSRC vult toewijzingen, resourceIds en materiaaluren op resourcekalender', {
    assignments: opened.assignments.map(assignment => ({
      taskId: assignment.taskId,
      resourceId: assignment.resourceId,
      unitsPerDay: assignment.unitsPerDay,
      curve: assignment.curve,
    })),
    taskResourceIds: opened.tasks.filter(task => !task.isSummary).map(task => [task.id, task.resourceIds]),
  }, {
    assignments: [
      { taskId: 'T1', resourceId: 'xer-resource:42', unitsPerDay: 0.5, curve: 'BELL' },
      { taskId: 'T2', resourceId: 'xer-resource:MAT', unitsPerDay: 30 },
    ],
    taskResourceIds: [['T1', ['xer-resource:42']], ['T2', ['xer-resource:MAT']]],
  });
  const xer = opened.xer as unknown as {
    resources?: {
      catalog: { rows: { assignments: readonly unknown[]; curves: readonly { rawPoints: readonly string[] }[] } };
      assignments: readonly { rawRow: object; projectSourceId?: string; quantities: unknown; costs: unknown }[];
    };
  };
  eq('X6-d retained bronmetadata houdt 21 curvepunten en raw assignment-identiteit vast', {
    rawAssignments: xer.resources?.catalog.rows.assignments.length,
    projectAssignments: xer.resources?.assignments.length,
    points: xer.resources?.catalog.rows.curves[0]?.rawPoints.length,
    sameRow: xer.resources?.assignments[0]?.rawRow === xer.resources?.catalog.rows.assignments[0],
  }, { rawAssignments: 2, projectAssignments: 2, points: 21, sameRow: true });
}

const multiLines = [
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tdef_duration_type\tlast_recalc_date',
  '%R\tP1\tEen\tCP\tDT_FixedDUR2\t2026-01-01',
  '%R\tP2\tTwee\tCP\tDT_FixedDUR2\t2026-01-01',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\ttask_name\ttask_code\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\ttask_type\tstatus_code',
  '%R\tT1\tP1\tEen\tE1\t2026-01-01\t2026-01-02\t8\tTT_Task\tTK_NotStart',
  '%R\tT2\tP2\tTwee\tE2\t2026-01-01\t2026-01-02\t8\tTT_Task\tTK_NotStart',
  '%T\tRSRC',
  '%F\trsrc_id\trsrc_name\trsrc_type\tdef_qty_per_hr',
  '%R\tR1\tGedeeld\tRT_Labor\t1',
  '%T\tTASKRSRC',
  '%F\ttaskrsrc_id\tproj_id\ttask_id\trsrc_id\ttarget_qty_per_hr',
  '%R\tA1\tP1\tT1\tR1\t1',
  '%R\tA2\tP2\tT2\tR1\t2',
  '%R\tA-BASELINE\tB9\tTB\tR1\t9',
  '%E',
] as const;
const multi = readXER(bytes(multiLines));
if (!isMultiDocumentImport(multi)) {
  diffs.push('X6-e tweeporject-fixture moet de X4b-meerdocumentvorm volgen');
} else {
  const [first, second] = multi.results;
  const firstXer = first.xer as unknown as { resources?: { catalog: { rows: { assignments: readonly object[] } }; assignments: readonly { rawRow: object }[] } };
  const secondXer = second.xer as unknown as { resources?: { catalog: { rows: { assignments: readonly object[] } }; assignments: readonly { rawRow: object }[] } };
  eq('X6-e partitioneert TASKRSRC lineair per project, behoudt unscoped/baselinebronnen en deelt catalogusidentiteit', {
    projects: multi.results.map(result => [result.project.id, result.assignments.map(assignment => assignment.id)]),
    rawRows: firstXer.resources?.catalog.rows.assignments.length,
    sharedCatalog: firstXer.resources?.catalog === secondXer.resources?.catalog,
    projectRowIdentity: secondXer.resources?.assignments[0]?.rawRow === secondXer.resources?.catalog.rows.assignments[1],
  }, {
    projects: [['P1', ['xer-assignment:A1']], ['P2', ['xer-assignment:A2']]],
    rawRows: 3,
    sharedCatalog: true,
    projectRowIdentity: true,
  });
  first.resources[0].name = 'Alleen project P1';
  first.assignments[0].unitsPerDay = 99;
  eq('X6-e2 projectprojecties zijn mutable en onderling geïsoleerd, terwijl de catalogus immutable gedeeld blijft', {
    firstResource: first.resources[0].name,
    secondResource: second.resources[0].name,
    firstUnits: first.assignments[0].unitsPerDay,
    secondUnits: second.assignments[0].unitsPerDay,
    catalogFrozen: Object.isFrozen(firstXer.resources?.catalog),
    catalogRowsFrozen: Object.isFrozen(firstXer.resources?.catalog.rows),
  }, {
    firstResource: 'Alleen project P1',
    secondResource: 'Gedeeld',
    firstUnits: 99,
    secondUnits: 2,
    catalogFrozen: true,
    catalogRowsFrozen: true,
  });
}

const baseline = readXER(bytes(multiLines.map(line => {
  if (line === '%F\tproj_id\tproj_short_name\tclndr_id\tdef_duration_type\tlast_recalc_date') {
    return `${line}\tsum_base_proj_id`;
  }
  if (line === '%R\tP1\tEen\tCP\tDT_FixedDUR2\t2026-01-01') return `${line}\tP2`;
  if (line === '%R\tP2\tTwee\tCP\tDT_FixedDUR2\t2026-01-01') return `${line}\t`;
  return line;
})));
if (!isMultiDocumentImport(baseline)) {
  diffs.push('X6-f baseline-fixture moet via de X4b-meerdocumentvorm openen');
} else {
  const result = baseline.results[0];
  const xer = result?.xer as unknown as { resources?: { catalog: { rows: { assignments: readonly object[] } } } };
  eq('X6-f baselineproject wordt niet geopend maar zijn TASKRSRC-bronrijen blijven ongeschonden voor X9 retained', {
    documents: baseline.results.map(item => item.project.id),
    baselines: result?.baselines?.map(item => item.id),
    rawAssignments: xer.resources?.catalog.rows.assignments.length,
  }, { documents: ['P1'], baselines: ['xer-baseline:P1:P2'], rawAssignments: 3 });
}

if (diffs.length > 0) {
  console.error(`XX X6 XER-resources (${checks} checks)\n${diffs.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`OK X6 XER-resources (${checks} checks)`);
}
