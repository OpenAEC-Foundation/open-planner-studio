import { isMultiDocumentImport } from '@/services/importTypes';
import { readXER, type XerReadResult } from '@/services/xer/xerReader';
import { XerImportError } from '@/services/xer/xerTables';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown): void => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

const header = [
  'ERMHDR\t23.12\t2026-08-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
  '%R\tP1\tFamilies\tC1\t2026-08-10 08:00',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tWerkweek\tP1\tCA_Project\t8\t40\t',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\tcomplete_pct_type\tcomplete_pct\tphys_complete_pct\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
] as const;

function readRows(rows: readonly string[]): XerReadResult | XerImportError {
  try {
    const result = readXER(new TextEncoder().encode([...header, ...rows, '%E'].join('\n')));
    if (isMultiDocumentImport(result)) throw new Error('familiefixture gaf meerdere documenten');
    return result;
  } catch (error) {
    if (error instanceof XerImportError) return error;
    throw error;
  }
}

function taskSummary(row: string): unknown {
  const result = readRows([row]);
  if (result instanceof XerImportError) {
    return { error: result.xerCode, table: result.table, field: result.field };
  }
  const task = result.tasks[0];
  return {
    type: task?.p6CompletePctType,
    status: task?.status,
    completion: task?.time.completion,
    remainingMinutes: task?.time.remainingMinutes,
  };
}

eq('a CP_Drtn negeert een ongeldig fysiek percentage', taskSummary(
  '%R\tD\tP1\tC1\tD\tDuur\tTT_Task\tTK_Active\tCP_Drtn\t25\tBAD\t8\t1\t2026-08-03 08:00\t2026-08-03 16:00\t2026-08-03 08:00\t',
), { type: 'CP_Drtn', status: 'STARTED', completion: 0.25, remainingMinutes: 360 });

eq('b CP_Phys negeert een ongeldig complete_pct', taskSummary(
  '%R\tP\tP1\tC1\tP\tFysiek\tTT_Task\tTK_Active\tCP_Phys\tBAD\t75\t8\t6\t2026-08-03 08:00\t2026-08-03 16:00\t2026-08-03 08:00\t',
), { type: 'CP_Phys', status: 'STARTED', completion: 0.75, remainingMinutes: 360 });

eq('c CP_Units negeert een ongeldig fysiek percentage', taskSummary(
  '%R\tU\tP1\tC1\tU\tEenheden\tTT_Task\tTK_Active\tCP_Units\t50\tBAD\t8\t2\t2026-08-03 08:00\t2026-08-03 16:00\t2026-08-03 08:00\t',
), { type: 'CP_Units', status: 'STARTED', completion: 0.5, remainingMinutes: 120 });

eq('d ontbrekend type blijft afwezig, gebruikt legacy fysiek percentage en bewaart bronremaining', taskSummary(
  '%R\tL\tP1\tC1\tL\tLegacy\tTT_Task\tTK_Active\t\t25\t75\t8\t1\t2026-08-03 08:00\t2026-08-03 16:00\t2026-08-03 08:00\t',
), { type: undefined, status: 'STARTED', completion: 0.75, remainingMinutes: 60 });

eq('e expliciete status dwingt 0/1 af zonder percentagekolommen te parsen', [
  taskSummary('%R\tNS\tP1\tC1\tNS\tNiet gestart\tTT_Task\tTK_NotStart\tCP_Drtn\tBAD\tBAD\t8\t1\t2026-08-03 08:00\t2026-08-03 16:00\t\t'),
  taskSummary('%R\tDONE\tP1\tC1\tDONE\tGereed\tTT_Task\tTK_Complete\tCP_Phys\tBAD\tBAD\t8\t0\t2026-08-03 08:00\t2026-08-03 16:00\t2026-08-03 08:00\t2026-08-03 16:00'),
], [
  { type: 'CP_Drtn', status: 'NOT_STARTED', completion: 0, remainingMinutes: 60 },
  { type: 'CP_Phys', status: 'COMPLETED', completion: 1, remainingMinutes: 0 },
]);

for (const [label, row, field] of [
  ['CP_Drtn', '%R\tBD\tP1\tC1\tBD\tBad duur\tTT_Task\tTK_Active\tCP_Drtn\tBAD\t75\t8\t1\t2026-08-03 08:00\t2026-08-03 16:00\t2026-08-03 08:00\t', 'complete_pct'],
  ['CP_Phys', '%R\tBP\tP1\tC1\tBP\tBad fysiek\tTT_Task\tTK_Active\tCP_Phys\t25\tBAD\t8\t1\t2026-08-03 08:00\t2026-08-03 16:00\t2026-08-03 08:00\t', 'phys_complete_pct'],
  ['CP_Units', '%R\tBU\tP1\tC1\tBU\tBad eenheden\tTT_Task\tTK_Active\tCP_Units\tBAD\t75\t8\t1\t2026-08-03 08:00\t2026-08-03 16:00\t2026-08-03 08:00\t', 'complete_pct'],
  ['legacy', '%R\tBL\tP1\tC1\tBL\tBad legacy\tTT_Task\tTK_Active\t\tBAD\tBAD\t8\t1\t2026-08-03 08:00\t2026-08-03 16:00\t2026-08-03 08:00\t', 'phys_complete_pct'],
] as const) {
  const result = readRows([row]);
  eq(`${label} relevant ongeldig percentage faalt typed`, result instanceof XerImportError ? {
    code: result.xerCode, table: result.table, field: result.field,
  } : result, { code: 'XER_INVALID_NUMBER', table: 'TASK', field });
}

if (diffs.length > 0) {
  console.error(`XER-X7-percentagefamilies: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK XER-X7-percentagefamilies: ${checks} checks groen`);
