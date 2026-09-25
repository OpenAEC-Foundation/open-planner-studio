/**
 * X6-contract: de lezer projecteert P6-resources/toewijzingen zonder de bestandsbrede bronrijen
 * te kopiëren. Breuken die dit vangt: TASKRSRC negeren, resource/rol-id's mengen, material-rate
 * als percentage interpreteren, curvepunten weggooien, of mutable parserrijen delen.
 */
import { readXER } from '@/services/xer/xerReader';
import { parseXerTables } from '@/services/xer/xerTables';
import { isMultiDocumentImport } from '@/services/importTypes';
import { readXerCalendars } from '@/services/xer/xerCalendarData';
import { indexXerTaskResourceRows } from '@/services/xer/xerResourceAssignments';
import { buildXerResourceCatalog, materializeXerResources } from '@/services/xer/xerResources';
import { CONTOUR_SHAPE_VALUES } from '@/engine/contour/contourEngine';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function present<T>(label: string, value: T | null | undefined): value is T {
  checks++;
  if (value === null || value === undefined) {
    diffs.push(`${label}: verplichte testdata ontbreekt`);
    return false;
  }
  return true;
}

function rejectsMutation(label: string, mutate: () => void): void {
  checks++;
  try {
    mutate();
    diffs.push(`${label}: mutatie werd niet door runtime-freeze geweigerd`);
  } catch (error) {
    if (!(error instanceof TypeError)) diffs.push(`${label}: verwacht TypeError, kreeg ${String(error)}`);
  }
}

/** Een clone-regressie mag deze contracttest niet vóór zijn diagnostiek doen crashen. */
function mutatesProjectView(label: string, mutate: () => void): void {
  checks++;
  try {
    mutate();
  } catch (error) {
    diffs.push(`${label}: gematerialiseerde projectie is niet mutable (${error instanceof TypeError ? error.message : String(error)})`);
  }
}

function bytes(lines: readonly string[]): Uint8Array {
  return new TextEncoder().encode(lines.join('\n'));
}

const curveFields = Array.from({ length: 21 }, (_, index) => `pct_usage_${index}`);
// Exacte contour-engine-tabel (CONTOUR_SHAPE_VALUES.BELL): bewust NIET afgerond of herschaald, want
// `matchCurveValues` matcht op exacte tabelwaarden (tolerantie 1e-6). `curv_name` ('Klok') is met
// opzet GEEN P6-curvenaam — dit bewijst dat de exacte-tabelmatch de naam-terugval niet nodig heeft.
const bell = [...CONTOUR_SHAPE_VALUES.BELL];
// Lineaire aanloop-ramp die GEEN van de acht contour-engine-tabellen exact raakt (front-loaded
// vorm, maar 6/4 in plaats van FRONT_LOADED's eigen 6.5/3.5) — bewijst de P6_NAME_TO_CURVE-
// naamterugval: alleen leesbaar via `curv_name` ('Front Loaded'), nooit via een tabelmatch.
const frontLoadedRamp = [0, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
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
  '%R\tT3\tP1\tControle\tA3\t2026-01-01\t2026-01-02\t8\tTT_Task\tTK_NotStart',
  '%R\tT4\tP1\tSchilderen\tA4\t2026-01-01\t2026-01-02\t8\tTT_Task\tTK_NotStart',
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
  '%R\tR-ORPHAN\tNOPE\t1\t99\t2026-01-01 00:00',
  '%T\tROLERATE',
  '%F\trole_rate_id\trole_id\tmax_qty_per_hr\tcost_per_qty\tstart_date',
  '%R\tROLE-RATE\t42\t0.75\t80\t2026-02-01 00:00',
  '%T\tRSRCCURVDATA',
  `%F\tcurv_id\tcurv_name\t${curveFields.join('\t')}`,
  `%R\tC-BELL\tKlok\t${bell.join('\t')}`,
  `%R\tC-RAMP\tFront Loaded\t${frontLoadedRamp.join('\t')}`,
  '%T\tTASKRSRC',
  '%F\ttaskrsrc_id\tproj_id\ttask_id\trsrc_id\trole_id\ttarget_qty_per_hr\tremain_qty_per_hr\tremain_qty\ttarget_qty\tcurv_id\ttarget_crv\tremain_crv\tactual_crv\tcost_per_qty\ttarget_cost\tremain_cost',
  '%R\tA-LABOR\tP1\tT1\t42\t42\t0.5\t0.5\t4\t5\tC-BELL\tTC\tRC\tAC\t25\t125\t100',
  '%R\tA-MATERIAL\tP1\tT2\tMAT\t\t3\t3\t18\t24\t\t\t\t\t4\t96\t72',
  '%R\tA-ROLE\tP1\tT3\t\t42\t0.25\t0.25\t2\t2\t\t\t\t\t80\t160\t120',
  '%R\tA-LABOR2\tP1\tT4\t42\t\t0.5\t0.5\t4\t5\tC-RAMP\t\t\t\t25\t125\t100',
  '%E',
]);

const parsed = parseXerTables(fixture);
const taskRow = parsed.tables.get('TASK')?.rows[0];
eq('X6-a parser bevries gedeelde TASKRSRC- en taakbronrijen', {
  row: taskRow ? Object.isFrozen(taskRow) : false,
  cells: taskRow ? Object.isFrozen(taskRow.cells) : false,
}, { row: true, cells: true });

const directCalendars = readXerCalendars(parsed);
const directCatalog = buildXerResourceCatalog(parsed, new Set(directCalendars.calendars.map(calendar => calendar.id)));
const directProjectCalendar = directCalendars.byId.get('CP');
if (present('X6-a2 directe materialisatie heeft projectkalender', directProjectCalendar)) {
  const directMaterialized = materializeXerResources(directCatalog, parsed, {
    projectId: 'P1', projectCalendarId: directProjectCalendar.id, projectHoursPerDay: directProjectCalendar.hoursPerDay,
    availableCalendarIds: new Set(directCalendars.calendars.map(calendar => calendar.id)),
    calendarHoursPerDay: new Map(directCalendars.calendars.map(calendar => [calendar.id, calendar.hoursPerDay])),
    taskIds: new Set(['T1', 'T2', 'T3']),
  }, indexXerTaskResourceRows(parsed).get('P1') ?? []);
  const peerMaterialized = materializeXerResources(directCatalog, parsed, {
    projectId: 'P1', projectCalendarId: directProjectCalendar.id, projectHoursPerDay: directProjectCalendar.hoursPerDay,
    availableCalendarIds: new Set(directCalendars.calendars.map(calendar => calendar.id)),
    calendarHoursPerDay: new Map(directCalendars.calendars.map(calendar => [calendar.id, calendar.hoursPerDay])),
    taskIds: new Set(['T1', 'T2', 'T3']),
  }, indexXerTaskResourceRows(parsed).get('P1') ?? []);
  const catalogResource = directCatalog.resources.find(resource => resource.id === 'xer-resource:42');
  const materializedResource = directMaterialized.resources.find(resource => resource.id === 'xer-resource:42');
  const peerResource = peerMaterialized.resources.find(resource => resource.id === 'xer-resource:42');
  const catalogResourceSource = directCatalog.rows.resources.find(source => source.sourceId === '42');
  const materializedResourceSource = directMaterialized.sources.resources.find(source => source.sourceId === '42');
  const peerResourceSource = peerMaterialized.sources.resources.find(source => source.sourceId === '42');
  eq('X6-a2 resourceprojectie heeft eigen objectidentiteit ten opzichte van catalogus en peerprojectie', {
    catalog: materializedResource !== catalogResource,
    peer: materializedResource !== peerResource,
    sourceCatalog: materializedResourceSource !== catalogResourceSource,
    sourcePeer: materializedResourceSource !== peerResourceSource,
  }, { catalog: true, peer: true, sourceCatalog: true, sourcePeer: true });
  if (present('X6-a2 directe materialisatie heeft resourcekopie', materializedResource)) {
    mutatesProjectView('X6-a2 resourceprojectie', () => { materializedResource.name = 'Alleen directe projectview'; });
  }
  if (present('X6-a2 directe materialisatie heeft resourcebronkopie', materializedResourceSource)) {
    mutatesProjectView('X6-a2 resourcebronprojectie', () => { materializedResourceSource.rawType = 'Alleen projectview'; });
  }
  eq('X6-a2 resourceprojectie is geïsoleerd van catalogus en peerprojectie', {
    catalog: catalogResource?.name,
    peer: peerResource?.name,
    catalogSource: catalogResourceSource?.rawType,
    peerSource: peerResourceSource?.rawType,
  }, { catalog: 'Vakman', peer: 'Vakman', catalogSource: 'RT_Labor', peerSource: 'RT_Labor' });

  const materializedRole = directMaterialized.resources.find(resource => resource.id === 'xer-role:42');
  const peerRole = peerMaterialized.resources.find(resource => resource.id === 'xer-role:42');
  const catalogRoleSource = directCatalog.rows.roles.find(source => source.sourceId === '42');
  const materializedRoleSource = directMaterialized.sources.roles.find(source => source.sourceId === '42');
  const peerRoleSource = peerMaterialized.sources.roles.find(source => source.sourceId === '42');
  eq('X6-a3 roleprojectie heeft eigen objectidentiteit ten opzichte van catalogus en peerprojectie', {
    rolePeer: materializedRole !== peerRole,
    sourceCatalog: materializedRoleSource !== catalogRoleSource,
    sourcePeer: materializedRoleSource !== peerRoleSource,
  }, { rolePeer: true, sourceCatalog: true, sourcePeer: true });
  if (present('X6-a3 directe materialisatie heeft rolekopie', materializedRole)) {
    mutatesProjectView('X6-a3 roleprojectie', () => { materializedRole.name = 'Alleen directe roleview'; });
  }
  if (present('X6-a3 directe materialisatie heeft rolebronkopie', materializedRoleSource)) {
    mutatesProjectView('X6-a3 rolebronprojectie', () => { materializedRoleSource.name = 'Alleen roleprojectie'; });
  }
  eq('X6-a3 roleprojectie is geïsoleerd van catalogus en peerprojectie', {
    peerRole: peerRole?.name,
    catalogSource: catalogRoleSource?.name,
    peerSource: peerRoleSource?.name,
  }, { peerRole: 'Ontwerper', catalogSource: 'Ontwerper', peerSource: 'Ontwerper' });

  const materializedAssignment = directMaterialized.assignments.find(assignment => assignment.id === 'xer-assignment:A-LABOR');
  const peerAssignment = peerMaterialized.assignments.find(assignment => assignment.id === 'xer-assignment:A-LABOR');
  const materializedAssignmentSource = directMaterialized.sources.assignments.find(source => source.sourceId === 'A-LABOR');
  const peerAssignmentSource = peerMaterialized.sources.assignments.find(source => source.sourceId === 'A-LABOR');
  const catalogAssignmentRow = directCatalog.rows.assignments.find(row => row.cells.taskrsrc_id === 'A-LABOR');
  eq('X6-a4 assignmentprojectie heeft eigen identiteit, maar behoudt raw-row-identiteit', {
    assignmentPeer: materializedAssignment !== peerAssignment,
    sourcePeer: materializedAssignmentSource !== peerAssignmentSource,
    rawRow: materializedAssignmentSource?.rawRow === catalogAssignmentRow,
  }, { assignmentPeer: true, sourcePeer: true, rawRow: true });
  if (present('X6-a4 directe materialisatie heeft assignmentkopie', materializedAssignment)) {
    mutatesProjectView('X6-a4 assignmentprojectie', () => { materializedAssignment.unitsPerDay = 99; });
  }
  if (present('X6-a4 directe materialisatie heeft assignmentbronkopie', materializedAssignmentSource)) {
    mutatesProjectView('X6-a4 assignmentbronprojectie', () => { materializedAssignmentSource.quantities.target = 99; });
  }
  eq('X6-a4 assignmentprojectie is geïsoleerd van peerprojectie', {
    peerUnits: peerAssignment?.unitsPerDay,
    peerTarget: peerAssignmentSource?.quantities.target,
  }, { peerUnits: 0.5, peerTarget: 5 });
}

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
      {
        id: 'xer-role:42', type: 'LABOR', maxUnits: 0,
        costPerHour: 80, availabilitySteps: [{ from: '2026-02-01', maxUnits: 0.75 }],
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
      // C-BELL matcht de contour-engine-tabel EXACT ⇒ `matchCurveValues` beslist, `curv_name`
      // ('Klok') is geen P6-naam en wordt niet geraadpleegd.
      { taskId: 'T1', resourceId: 'xer-resource:42', unitsPerDay: 0.5, curve: 'BELL' },
      { taskId: 'T2', resourceId: 'xer-resource:MAT', unitsPerDay: 30 },
      { taskId: 'T3', resourceId: 'xer-role:42', unitsPerDay: 0.25 },
      // C-RAMP matcht GEEN tabel exact ⇒ `matchCurveValues` geeft undefined, de OPS-curve komt
      // uitsluitend uit de `P6_NAME_TO_CURVE['Front Loaded']`-terugval.
      { taskId: 'T4', resourceId: 'xer-resource:42', unitsPerDay: 0.5, curve: 'FRONT_LOADED' },
    ],
    taskResourceIds: [
      ['T1', ['xer-resource:42']],
      ['T2', ['xer-resource:MAT']],
      ['T3', ['xer-role:42']],
      ['T4', ['xer-resource:42']],
    ],
  });
  const t1Assignment = opened.assignments.find(assignment => assignment.taskId === 'T1');
  const t4Assignment = opened.assignments.find(assignment => assignment.taskId === 'T4');
  eq('X6-c2 curveValues draagt de genormaliseerde 21-punts RSRCCURVDATA-data (index0 op 0)', {
    t1: t1Assignment?.curveValues,
    t4: t4Assignment?.curveValues,
  }, {
    t1: [0, ...CONTOUR_SHAPE_VALUES.BELL.slice(1)],
    t4: frontLoadedRamp,
  });
  const xer = opened.xer.resources;
  const catalog = xer?.catalog;
  const curve = catalog?.rows.curves.find(item => item.sourceId === 'C-BELL');
  const resourceRate = catalog?.rows.rates.find(item => item.sourceId === 'R-1');
  const projectAssignment = xer?.assignments.find(item => item.sourceId === 'A-LABOR');
  const rawAssignment = catalog?.rows.assignments.find(row => row.cells.taskrsrc_id === 'A-LABOR');
  eq('X6-d retained bronmetadata houdt 21 curvepunten en raw assignment-identiteit vast', {
    rawAssignments: catalog?.rows.assignments.length,
    projectAssignments: xer?.assignments.length,
    points: curve?.rawPoints.length,
    numericPoints: curve?.numericPoints?.length,
    sameRow: projectAssignment?.rawRow === rawAssignment,
  }, { rawAssignments: 4, projectAssignments: 4, points: 21, numericPoints: 21, sameRow: true });

  const firstResource = catalog?.resources.find(resource => resource.id === 'xer-resource:42');
  const firstSource = catalog?.rows.resources.find(source => source.sourceId === '42');
  const orphanIssue = catalog?.issues.find(issue => issue.sourceId === 'R-ORPHAN');
  eq('X6-d2 volledige catalogusobjectgraaf is expliciet runtime-deep-frozen', {
    catalog: catalog ? Object.isFrozen(catalog) : false,
    resources: catalog ? Object.isFrozen(catalog.resources) : false,
    resource: firstResource ? Object.isFrozen(firstResource) : false,
    availabilitySteps: firstResource?.availabilitySteps ? Object.isFrozen(firstResource.availabilitySteps) : false,
    availabilityStep: firstResource?.availabilitySteps?.[0] ? Object.isFrozen(firstResource.availabilitySteps[0]) : false,
    identities: catalog ? Object.isFrozen(catalog.identities) : false,
    identity: catalog?.identities[0] ? Object.isFrozen(catalog.identities[0]) : false,
    rows: catalog ? Object.isFrozen(catalog.rows) : false,
    source: firstSource ? Object.isFrozen(firstSource) : false,
    sourceRawRow: firstSource ? Object.isFrozen(firstSource.rawRow) : false,
    sourceCells: firstSource ? Object.isFrozen(firstSource.rawRow.cells) : false,
    rate: resourceRate ? Object.isFrozen(resourceRate) : false,
    rateEntity: resourceRate ? Object.isFrozen(resourceRate.entity) : false,
    rateCostsTuple: resourceRate ? Object.isFrozen(resourceRate.costs) : false,
    curve: curve ? Object.isFrozen(curve) : false,
    rawCurveTuple: curve ? Object.isFrozen(curve.rawPoints) : false,
    numericCurveTuple: curve?.numericPoints ? Object.isFrozen(curve.numericPoints) : false,
    assignments: catalog ? Object.isFrozen(catalog.rows.assignments) : false,
    assignmentRow: rawAssignment ? Object.isFrozen(rawAssignment) : false,
    assignmentCells: rawAssignment ? Object.isFrozen(rawAssignment.cells) : false,
    issues: catalog ? Object.isFrozen(catalog.issues) : false,
    issue: orphanIssue ? Object.isFrozen(orphanIssue) : false,
  }, {
    catalog: true, resources: true, resource: true, availabilitySteps: true,
    availabilityStep: true, identities: true, identity: true, rows: true, source: true,
    sourceRawRow: true, sourceCells: true, rate: true, rateEntity: true,
    rateCostsTuple: true, curve: true, rawCurveTuple: true, numericCurveTuple: true,
    assignments: true, assignmentRow: true, assignmentCells: true, issues: true, issue: true,
  });

  if (present('X6-d3 mutatieproef heeft catalogusresource', firstResource)) {
    rejectsMutation('X6-d3 catalogusresource weigert mutatie vóór X4b-fan-out', () => {
      (firstResource as unknown as { name: string }).name = 'verboden';
    });
  }
  if (present('X6-d4 mutatieproef heeft ratetuple', resourceRate?.costs)) {
    rejectsMutation('X6-d4 catalogus-ratetuple weigert mutatie vóór X4b-fan-out', () => {
      (resourceRate.costs as unknown as [number | null, number | null, number | null, number | null, number | null])[0] = 9_999;
    });
  }
  if (present('X6-d5 mutatieproef heeft curvepunten', curve?.rawPoints)) {
    rejectsMutation('X6-d5 catalogus-curvetuple weigert mutatie vóór X4b-fan-out', () => {
      (curve.rawPoints as unknown as [string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string])[0] = '9999';
    });
  }
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
  '%R\tA-MISSING\tP1\tT-MISSING\tR1\t7',
  '%R\tA2\tP2\tT2\tR1\t2',
  '%R\tA-UNSCOPED\t\tT1\tR1\t8',
  '%R\tA-BASELINE\tB9\tTB\tR1\t9',
  '%E',
] as const;
const multi = readXER(bytes(multiLines));
if (!isMultiDocumentImport(multi)) {
  diffs.push('X6-e tweeporject-fixture moet de X4b-meerdocumentvorm volgen');
} else {
  const [first, second] = multi.results;
  const firstXer = first?.xer?.resources;
  const secondXer = second?.xer?.resources;
  const firstAssignment = first?.assignments.find(assignment => assignment.id === 'xer-assignment:A1');
  const secondAssignment = second?.assignments.find(assignment => assignment.id === 'xer-assignment:A2');
  const secondSource = secondXer?.assignments.find(source => source.sourceId === 'A2');
  const secondRawRow = secondXer?.catalog.rows.assignments.find(row => row.cells.taskrsrc_id === 'A2');
  eq('X6-e partitioneert TASKRSRC lineair per project, behoudt unscoped/baselinebronnen en deelt catalogusidentiteit', {
    projects: multi.results.map(result => [result.project.id, result.assignments.map(assignment => assignment.id)]),
    sourceViews: multi.results.map(result => [result.project.id, result.xer?.resources?.assignments.map(source => source.sourceId)]),
    missingTaskIssues: firstXer?.issues.filter(issue => issue.code === 'XER_ASSIGNMENT_TASK_MISSING').map(issue => issue.sourceId),
    rawRows: firstXer?.catalog.rows.assignments.length,
    sharedCatalog: firstXer?.catalog === secondXer?.catalog,
    projectRowIdentity: secondSource?.rawRow === secondRawRow,
  }, {
    projects: [['P1', ['xer-assignment:A1']], ['P2', ['xer-assignment:A2']]],
    sourceViews: [['P1', ['A1', 'A-MISSING']], ['P2', ['A2']]],
    missingTaskIssues: ['A-MISSING'],
    rawRows: 5,
    sharedCatalog: true,
    projectRowIdentity: true,
  });
  const firstResource = first?.resources.find(resource => resource.id === 'xer-resource:R1');
  const secondResource = second?.resources.find(resource => resource.id === 'xer-resource:R1');
  if (present('X6-e2 P1-resource bestaat', firstResource)) firstResource.name = 'Alleen project P1';
  if (present('X6-e2 P1-assignment bestaat', firstAssignment)) firstAssignment.unitsPerDay = 99;
  eq('X6-e2 projectprojecties zijn mutable en onderling geïsoleerd, terwijl de catalogus immutable gedeeld blijft', {
    firstResource: firstResource?.name,
    secondResource: secondResource?.name,
    firstUnits: firstAssignment?.unitsPerDay,
    secondUnits: secondAssignment?.unitsPerDay,
    catalogFrozen: firstXer ? Object.isFrozen(firstXer.catalog) : false,
    catalogRowsFrozen: firstXer ? Object.isFrozen(firstXer.catalog.rows) : false,
  }, {
    firstResource: 'Alleen project P1',
    secondResource: 'Gedeeld',
    firstUnits: 99,
    secondUnits: 2,
    catalogFrozen: true,
    catalogRowsFrozen: true,
  });
  const sharedCatalog = firstXer?.catalog;
  const sharedCatalogResource = sharedCatalog?.resources.find(resource => resource.id === 'xer-resource:R1');
  if (present('X6-e3 gedeelde catalogusresource bestaat na X4b-fan-out', sharedCatalogResource)) {
    const originalName = secondXer?.catalog.resources.find(resource => resource.id === 'xer-resource:R1')?.name;
    rejectsMutation('X6-e3 catalogusmutatie wordt na X4b-fan-out geweigerd', () => {
      (sharedCatalogResource as unknown as { name: string }).name = 'lek naar P2';
    });
    eq('X6-e3 geweigerde catalogusmutatie kan P2 niet veranderen',
      secondXer?.catalog.resources.find(resource => resource.id === 'xer-resource:R1')?.name,
      originalName);
  }
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
  const xer = result?.xer?.resources;
  eq('X6-f baselineproject wordt niet geopend maar zijn TASKRSRC-bronrijen blijven ongeschonden voor X9 retained', {
    documents: baseline.results.map(item => item.project.id),
    baselines: result?.baselines?.map(item => item.id),
    rawAssignments: xer?.catalog.rows.assignments.length,
    retainedKinds: xer?.catalog.rows.assignments.map(row => row.cells.taskrsrc_id),
  }, {
    documents: ['P1'], baselines: ['xer-baseline:P1:P2'], rawAssignments: 5,
    retainedKinds: ['A1', 'A-MISSING', 'A2', 'A-UNSCOPED', 'A-BASELINE'],
  });
}

if (diffs.length > 0) {
  console.error(`XX X6 XER-resources (${checks} checks)\n${diffs.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`OK X6 XER-resources (${checks} checks)`);
}
