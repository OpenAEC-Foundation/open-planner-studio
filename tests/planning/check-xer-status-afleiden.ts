import { isMultiDocumentImport } from '@/services/importTypes';
import { normalizeImportedProgress } from '@/services/importNormalize';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readXER, type XerReadResult } from '@/services/xer/xerReader';
import { solveProject } from '@/engine/scheduler/solveProject';
import { solveOptionsFor } from '@/engine/scheduler/solveInput';
import type { Task } from '@/types/task';
import { readXerArchiveIFC as readIFC } from './xerArchiveTestReader';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function read(lines: readonly string[]): XerReadResult {
  const result = readXER(new TextEncoder().encode(lines.join('\n')));
  if (isMultiDocumentImport(result)) throw new Error('De enkelprojectfixture gaf meerdere documenten terug');
  return result;
}

const head = [
  'ERMHDR\t23.12\t2026-08-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
  '%R\tP1\tStatus afleiden\tC1\t2026-08-10 08:00',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tWerkweek\tP1\tCA_Project\t8\t40\t',
  '%T\tTASK',
] as const;

const rows = [
  ['AF', 'TT_Task', '', '', '100', '16', '0', '2026-08-03 08:00', '2026-08-04 16:00', '2026-08-03 08:00', '2026-08-04 16:00'],
  ['AFZ', 'TT_Task', '', '', '40', '16', '8', '2026-08-03 08:00', '2026-08-04 16:00', '', '2026-08-05 16:00'],
  ['P100', 'TT_Task', '', '', '100', '16', '0', '2026-08-03 08:00', '2026-08-04 16:00', '', ''],
  ['P100L', 'TT_Task', '', '', '100', '16', '0', '2026-08-12 08:00', '2026-08-13 16:00', '', ''],
  ['AS', 'TT_Task', '', '', '50', '16', '8', '2026-08-03 08:00', '2026-08-04 16:00', '2026-08-03 08:00', ''],
  ['AS0', 'TT_Task', '', '', '0', '16', '16', '2026-08-03 08:00', '2026-08-04 16:00', '2026-08-04 08:00', ''],
  ['PCT', 'TT_Task', '', '', '30', '16', '', '2026-08-03 08:00', '2026-08-04 16:00', '', ''],
  ['DRTN', 'TT_Task', 'CP_Drtn', '25', '', '16', '14', '2026-08-03 08:00', '2026-08-04 16:00', '2026-08-03 08:00', ''],
  ['NIETS', 'TT_Task', '', '', '0', '16', '16', '2026-08-11 08:00', '2026-08-12 16:00', '', ''],
] as const;

function taskLines(status: (code: string) => string | null): string[] {
  const withStatus = status('AF') !== null;
  return [
    `%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type${withStatus ? '\tstatus_code' : ''}\tcomplete_pct_type\tcomplete_pct\tphys_complete_pct\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date`,
    ...rows.map(([code, type, pctType, pct, phys, drtn, remain, ts, te, as, af]) => [
      '%R', code, 'P1', 'C1', code, code, type,
      ...(withStatus ? [status(code)!] : []),
      pctType, pct, phys, drtn, remain, ts, te, as, af,
    ].join('\t')),
  ];
}

const progressOf = (task: Task) => [
  task.status, task.time.completion, task.time.actualStart ?? null, task.time.actualFinish ?? null,
];
const byCode = (result: { tasks: readonly Task[] }) => new Map(
  result.tasks.filter(task => !task.isSummary).map(task => [task.wbsCode, task]),
);

const PINNED_FULL_STATUS = [
  ['AF', 'COMPLETED', 1, '2026-08-03T08:00', '2026-08-04T16:00', 0, null],
  ['AFZ', 'STARTED', 0.4, null, '2026-08-05T16:00', 480, null],
  ['P100', 'NOT_STARTED', 0, null, null, 0, null],
  ['P100L', 'COMPLETED', 1, null, null, 0, null],
  ['AS', 'STARTED', 0.5, '2026-08-03T08:00', null, 480, null],
  ['AS0', 'STARTED', 0, '2026-08-04T08:00', null, 960, null],
  ['PCT', 'NOT_STARTED', 0, null, null, null, null],
  ['DRTN', 'STARTED', 0.25, '2026-08-03T08:00', null, 720, null],
  ['NIETS', 'NOT_STARTED', 0, null, null, 960, null],
];

const PINNED_NO_ANCHOR = [null, 'COMPLETED', 1, '2026-08-03', '2026-08-03'];

const noColumn = read([...head, ...taskLines(() => null), '%E']);
const nc = byCode(noColumn);
eq('117-1 werkelijk einde + start op 100 % ⇒ voltooid, actuals ongewijzigd', progressOf(nc.get('AF')!),
  ['COMPLETED', 1, '2026-08-03T08:00', '2026-08-04T16:00']);
eq('117-2 werkelijk einde zonder start op 40 % ⇒ voltooid, 100 %, AS = AF', progressOf(nc.get('AFZ')!),
  ['COMPLETED', 1, '2026-08-05T16:00', '2026-08-05T16:00']);
eq('117-3 100 % zonder actuals ⇒ voltooid, AS = geplande start, AF = statusdatum', progressOf(nc.get('P100')!),
  ['COMPLETED', 1, '2026-08-03T08:00', '2026-08-10T08:00']);
eq('117-4 100 % zonder actuals, start ná statusdatum ⇒ AS = AF = statusdatum', progressOf(nc.get('P100L')!),
  ['COMPLETED', 1, '2026-08-10T08:00', '2026-08-10T08:00']);
eq('117-5 werkelijke start op 50 % ⇒ lopend, geen AF', progressOf(nc.get('AS')!),
  ['STARTED', 0.5, '2026-08-03T08:00', null]);
eq('117-6 werkelijke start op 0 % ⇒ lopend', progressOf(nc.get('AS0')!),
  ['STARTED', 0, '2026-08-04T08:00', null]);
eq('117-7 voortgang > 0 zonder actuals ⇒ lopend, geen verzonnen start', progressOf(nc.get('PCT')!),
  ['STARTED', 0.3, null, null]);
eq('117-8 geen voortgang ⇒ niet gestart', progressOf(nc.get('NIETS')!),
  ['NOT_STARTED', 0, null, null]);
eq('117-9 geen statuskolom ⇒ geen enum-melding', noColumn.xer.enumFallbacks, []);

const active = read([...head, ...taskLines(() => 'TK_Active'), '%E']);
const normalized = active.tasks.filter(task => !task.isSummary).map(task => structuredClone(task));
normalizeImportedProgress(normalized, active.project.statusDate);
for (const task of normalized) {
  eq(`117-10 ${task.wbsCode}: afleiding = normalizeImportedProgress`, progressOf(nc.get(task.wbsCode)!), progressOf(task));
}
const activeByCode = byCode(active);
eq('117-11 lopend CP_Drtn zonder status: restduur als TK_Active',
  [nc.get('DRTN')!.time.completion, nc.get('DRTN')!.time.remainingMinutes],
  [activeByCode.get('DRTN')!.time.completion, activeByCode.get('DRTN')!.time.remainingMinutes]);
eq('117-12 lopend CP_Drtn: restduur uit complete_pct (16 u × 75 %)', nc.get('DRTN')!.time.remainingMinutes, 720);

const mixedStatus: Record<string, string> = {
  AF: '', AFZ: 'TK_NotStart', P100: 'TK_Weird', P100L: '', AS: '  ', AS0: 'TK_Complete',
  PCT: 'TK_Active', DRTN: '', NIETS: '',
};
const mixed = read([...head, ...taskLines(code => mixedStatus[code]), '%E']);
const mx = byCode(mixed);
eq('117-13 lege cel + werkelijk einde ⇒ voltooid', progressOf(mx.get('AF')!),
  ['COMPLETED', 1, '2026-08-03T08:00', '2026-08-04T16:00']);
eq('117-14 lege cel + 100 % ⇒ voltooid met AS/AF-defaults', progressOf(mx.get('P100L')!),
  ['COMPLETED', 1, '2026-08-10T08:00', '2026-08-10T08:00']);
eq('117-15 cel met alleen spaties + werkelijke start ⇒ lopend', progressOf(mx.get('AS')!),
  ['STARTED', 0.5, '2026-08-03T08:00', null]);
eq('117-16 lege cel zonder voortgang ⇒ niet gestart', progressOf(mx.get('NIETS')!),
  ['NOT_STARTED', 0, null, null]);
eq('117-17 TK_NotStart met werkelijk einde blijft niet gestart op 0 % (knownbugs 115)', progressOf(mx.get('AFZ')!),
  ['NOT_STARTED', 0, null, '2026-08-05T16:00']);
eq('117-18 TK_Complete met alleen een start blijft voltooid zonder verzonnen AF', progressOf(mx.get('AS0')!),
  ['COMPLETED', 1, '2026-08-04T08:00', null]);
eq('117-19 TK_Active zonder actuals blijft lopend zonder verzonnen AS', progressOf(mx.get('PCT')!),
  ['STARTED', 0.3, null, null]);
eq('117-20 onbekende status op 100 % blijft de enum-fallback niet gestart', progressOf(mx.get('P100')!),
  ['NOT_STARTED', 1, null, null]);
eq('117-21 onbekende status geeft precies één enum-melding',
  mixed.xer.enumFallbacks.map(issue => [issue.family, issue.token, issue.fallback, issue.field]),
  [['status', 'TK_Weird', 'NOT_STARTED', 'status_code']]);

const fullStatus: Record<string, string> = {
  AF: 'TK_Complete', AFZ: 'TK_Active', P100: 'TK_NotStart', P100L: 'TK_Complete', AS: 'TK_Active',
  AS0: 'TK_Active', PCT: 'TK_NotStart', DRTN: 'TK_Active', NIETS: 'TK_NotStart',
};
const full = read([...head, ...taskLines(code => fullStatus[code]), '%E']);
eq('117-22 bestand mét status: status, completion, actuals en restduur zoals op main',
  full.tasks.filter(task => !task.isSummary).map(task => [
    task.wbsCode, ...progressOf(task), task.time.remainingMinutes ?? null, task.time.remainingTime ?? null,
  ]),
  PINNED_FULL_STATUS);

const noAnchor = read([
  'ERMHDR\t23.12\t2026-08-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id', '%R\tP1\tGeen anker\tC1',
  '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tWerkweek\tP1\tCA_Project\t8\t40\t',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tphys_complete_pct\ttarget_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
  '%R\tX1\tP1\tC1\tX1\tX1\tTT_Task\t100\t16\t\t\t\t',
  '%R\tX2\tP1\tC1\tX2\tX2\tTT_Task\t0\t16\t2026-08-03 08:00\t2026-08-04 16:00\t\t',
  '%E',
]);
const x1 = byCode(noAnchor).get('X1')!;
eq('117-25 100 % zonder statusdatum en zonder geplande start: defaults uit de aangevulde planning',
  [noAnchor.project.statusDate ?? null, ...progressOf(x1)], PINNED_NO_ANCHOR);
eq('117-26 geen plaatshouder-datum in de actuals',
  [x1.time.actualStart, x1.time.actualFinish].some(value => !value || value.startsWith('0001')), false);

const solved = solveProject({
  tasks: noColumn.tasks,
  sequences: noColumn.sequences,
  calendar: noColumn.calendar,
  calendars: [noColumn.calendar, ...(noColumn.resourceCalendars ?? [])],
  dataDate: noColumn.project.statusDate,
  progressMode: noColumn.project.progressMode,
  schedulingOptions: solveOptionsFor(noColumn.project).schedulingOptions,
  projectStartDate: noColumn.project.startDate,
});
eq('117-23 de solve rekent elke activiteit', [...nc.keys()].filter(code => !solved.tasks.has(nc.get(code)!.id)), []);
const reloaded = byCode(readIFC(writeIFC(noColumn)));
eq('117-24 na IFC-round-trip gelijke status, percentage en actuals',
  [...nc.values()].map(task => [task.wbsCode, ...progressOf(reloaded.get(task.wbsCode)!)]),
  [...nc.values()].map(task => [task.wbsCode, ...progressOf(task)]));

if (diffs.length > 0) {
  console.error(`XER-status-afleiden: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK  XER-status-afleiden (knownbugs 117): ${checks} checks groen`);
