import { solveProject } from '@/engine/scheduler/solveProject';
import { isMultiDocumentImport } from '@/services/importTypes';
import { readXER, type XerReadResult } from '@/services/xer/xerReader';

const failures: string[] = [];
let checks = 0;

function equal(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`);
  }
}

function xerLines(
  scheduleRow: string | undefined,
  remTargetLinkFlag: string,
  storedLateStart: string,
  storedFloat: string,
): string[] {
  return [
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC8\tAcht uur\t8\t40\t',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tcritical_path_type\tcritical_drtn_hr_cnt\trem_target_link_flag',
    `%R\tP-PROVENANCE\tProvenance\tC8\t2026-09-01 08:00\tCT_TotFloat\t8\t${remTargetLinkFlag}`,
    ...(scheduleRow ? [
      '%T\tSCHEDOPTIONS',
      '%F\tproj_id\tsched_float_type\tsched_use_project_end_date_for_float\tsched_calendar_on_relationship_lag\tsched_retained_logic\tsched_progress_override',
      `%R\tP-PROVENANCE\t${scheduleRow}\tY\tRCAL_Predecessor\tY\tN`,
    ] : []),
    '%T\tTASK',
    '%F\ttask_id\tproj_id\ttask_code\ttask_name\tclndr_id\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\tearly_start_date\tearly_end_date\tlate_start_date\tlate_end_date\ttotal_float_hr_cnt\tfree_float_hr_cnt',
    `%R\tT-PROVENANCE\tP-PROVENANCE\tP1\tTaak\tC8\t2026-09-01 08:00\t2026-09-02 16:00\t16\t16\t2026-09-01 08:00\t2026-09-02 16:00\t${storedLateStart}\t${storedLateStart}\t${storedFloat}\t${storedFloat}`,
    '%E',
  ];
}

function bytes(lines: readonly string[]): Uint8Array {
  return new TextEncoder().encode(lines.join('\n'));
}

function opened(source: Uint8Array): XerReadResult {
  const result = readXER(source);
  if (isMultiDocumentImport(result)) throw new Error('Fixture moet één project opleveren');
  return result;
}

function scheduleMetadata(result: XerReadResult): {
  source: string;
  retainedSource: unknown;
  fallbacks: unknown;
  diagnostics: unknown;
  projectSignal: string | undefined;
  scheduleRows: string[];
} {
  const metadata = result.xer.scheduleOptions;
  return {
    source: metadata.source,
    retainedSource: metadata.retainedSource,
    fallbacks: metadata.fallbacks,
    diagnostics: metadata.diagnostics,
    projectSignal: metadata.sourceRows.find(row => row.table === 'PROJECT')?.cells.rem_target_link_flag,
    scheduleRows: metadata.sourceRows
      .filter(row => row.table === 'SCHEDOPTIONS')
      .map(row => row.cells.sched_float_type ?? ''),
  };
}

function schedulingOptions(result: XerReadResult): unknown {
  return {
    progressMode: result.project.progressMode,
    schedulingOptions: result.project.schedulingOptions,
  };
}

function solverAxes(result: XerReadResult): unknown {
  const tasks = result.tasks.map(task => ({
    ...task,
    time: { ...task.time },
  }));
  solveProject({
    tasks,
    sequences: result.sequences,
    calendar: result.calendar,
    calendars: result.resourceCalendars ?? [],
    dataDate: result.project.statusDate,
    progressMode: result.project.progressMode,
    schedulingOptions: result.project.schedulingOptions,
    projectStartDate: result.project.startDate,
    projectEndDate: result.project.endDate,
  });
  return tasks.map(task => ({
    id: task.id,
    earlyStart: task.time.earlyStart,
    earlyFinish: task.time.earlyFinish,
    lateStart: task.time.lateStart,
    lateFinish: task.time.lateFinish,
    totalFloat: task.time.totalFloat,
    freeFloat: task.time.freeFloat,
  }));
}

const noRowY = opened(bytes(xerLines(undefined, 'Y', '2099-01-01 00:00', '999')));
const noRowN = opened(bytes(xerLines(undefined, 'N', '2099-01-01 00:00', '999')));
const finishRow = opened(bytes(xerLines('FT_FF', 'Y', '2099-01-01 00:00', '999')));
const startRow = opened(bytes(xerLines('FT_SS', 'Y', '2099-01-01 00:00', '999')));

equal('geen SCHEDOPTIONS-rij is herkenbaar als XER-defaults met PROJECT-signaal Y',
  scheduleMetadata(noRowY), {
    source: 'xer-defaults',
    retainedSource: {},
    fallbacks: [],
    diagnostics: [],
    projectSignal: 'Y',
    scheduleRows: [],
  });
equal('geen SCHEDOPTIONS-rij is herkenbaar als XER-defaults met PROJECT-signaal N',
  scheduleMetadata(noRowN), {
    source: 'xer-defaults',
    retainedSource: {},
    fallbacks: [],
    diagnostics: [],
    projectSignal: 'N',
    scheduleRows: [],
  });
equal('PROJECT-afleiding Y/N raakt uitsluitend de toegestane XER-progressievlag', [
  noRowY.project.schedulingOptions?.p6UseRemainingStartForProgress,
  noRowN.project.schedulingOptions?.p6UseRemainingStartForProgress,
], [true, false]);

const invalidProjectSignal = opened(bytes(xerLines(undefined, 'MAYBE', '2099-01-01 00:00', '999')));
equal('onbekend PROJECT-signaal valt fail-closed terug met een fallbackdiagnose', {
  source: invalidProjectSignal.xer.scheduleOptions.source,
  useRemainingStartForProgress:
    invalidProjectSignal.project.schedulingOptions?.p6UseRemainingStartForProgress,
  fallbacks: invalidProjectSignal.xer.scheduleOptions.fallbacks,
}, {
  source: 'xer-defaults',
  useRemainingStartForProgress: false,
  fallbacks: [{ field: 'rem_target_link_flag', token: 'MAYBE', fallback: 'false', line: 7 }],
});

equal('unieke finish-float-rij is expliciet schedoptions-provenance', scheduleMetadata(finishRow), {
  source: 'schedoptions',
  retainedSource: { sched_use_project_end_date_for_float: true },
  fallbacks: [],
  diagnostics: [],
  projectSignal: 'Y',
  scheduleRows: ['FT_FF'],
});
equal('finish-float-token kiest de finale SchedulingOptions zonder stored oracle', {
  progressMode: finishRow.project.progressMode,
  lagCalendar: finishRow.project.schedulingOptions?.lagCalendar,
  totalFloatMode: finishRow.project.schedulingOptions?.totalFloatMode,
  useProjectEndDateForFloat: finishRow.project.schedulingOptions?.useProjectEndDateForFloat,
  p6UseRemainingStartForProgress: finishRow.project.schedulingOptions?.p6UseRemainingStartForProgress,
}, {
  progressMode: 'RETAINED_LOGIC',
  lagCalendar: 'predecessor',
  totalFloatMode: 'finish',
  useProjectEndDateForFloat: true,
  p6UseRemainingStartForProgress: true,
});
equal('unieke start-float-rij is expliciet schedoptions-provenance', scheduleMetadata(startRow), {
  source: 'schedoptions',
  retainedSource: { sched_use_project_end_date_for_float: true },
  fallbacks: [],
  diagnostics: [],
  projectSignal: 'Y',
  scheduleRows: ['FT_SS'],
});
equal('start-float-token kiest uitsluitend totalFloatMode=start', {
  totalFloatMode: startRow.project.schedulingOptions?.totalFloatMode,
  lagCalendar: startRow.project.schedulingOptions?.lagCalendar,
  useProjectEndDateForFloat: startRow.project.schedulingOptions?.useProjectEndDateForFloat,
}, { totalFloatMode: 'start', lagCalendar: 'predecessor', useProjectEndDateForFloat: true });

const fallback = opened(bytes(xerLines('NOT_A_FLOAT_MODE', 'Y', '2099-01-01 00:00', '999')));
equal('onbekend SCHEDOPTIONS-token valt fail-closed terug naar de veilige finish-default', {
  source: fallback.xer.scheduleOptions.source,
  totalFloatMode: fallback.project.schedulingOptions?.totalFloatMode,
  fallbacks: fallback.xer.scheduleOptions.fallbacks,
  diagnostics: fallback.xer.scheduleOptions.diagnostics,
}, {
  source: 'schedoptions',
  totalFloatMode: 'finish',
  fallbacks: [{ field: 'sched_float_type', token: 'NOT_A_FLOAT_MODE', fallback: 'finish', line: 10 }],
  diagnostics: [],
});

// Mutatieproef 1: één tokenflip mag alleen de corresponderende option wijzigen.
equal('mutatieproef tokenflip: FT_FF -> FT_SS verandert de bronkeuze aantoonbaar',
  startRow.project.schedulingOptions?.totalFloatMode,
  'start');
equal('mutatieproef tokenflip laat de PROJECT-afleiding intact',
  startRow.project.schedulingOptions?.p6UseRemainingStartForProgress,
  finishRow.project.schedulingOptions?.p6UseRemainingStartForProgress);

// Mutatieproef 2: dezelfde bytes zonder de SCHEDOPTIONS-rij vallen terug naar defaults.
equal('mutatieproef row verwijderen: bron wordt XER-defaults', noRowY.xer.scheduleOptions.source, 'xer-defaults');
equal('mutatieproef row verwijderen: expliciet finish-float verdwijnt uit de finale options',
  noRowY.project.schedulingOptions?.totalFloatMode,
  'finish');
equal('mutatieproef row verwijderen: PROJECT-signaal blijft behouden',
  noRowY.project.schedulingOptions?.p6UseRemainingStartForProgress,
  true);

// Mutatieproef 3: stored P6-late/float-orakel wijzigen mag geen options of solverinput wijzigen.
const oracleMutated = opened(bytes(xerLines('FT_FF', 'Y', '1900-01-01 00:00', '-12345')));
equal('mutatieproef stored oracle: options blijven byte-identiek',
  schedulingOptions(oracleMutated), schedulingOptions(finishRow));
equal('mutatieproef stored oracle: solverresultaat blijft byte-identiek',
  solverAxes(oracleMutated), solverAxes(finishRow));

if (failures.length > 0) {
  for (const failure of failures) console.error(`XX ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`OK XER schedule-option provenance: ${checks} checks`);
}
