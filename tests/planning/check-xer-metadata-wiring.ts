import { isMultiDocumentImport } from '@/services/importTypes';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { payloadFromImport } from '@/state/documentContract';
import { readXER } from '@/services/xer/xerReader';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

const source = new TextEncoder().encode([
  'ERMHDR\t23.12',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
  '%R\tP-A\tProject A\tC\t2026-01-01 08:00',
  '%R\tP-B\tProject B\tC\t2026-01-01 08:00',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC\tStandaard\t8\t40\t',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\ttask_code\ttask_name\tclndr_id\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\ttask_notes',
  '%R\tSHARED\tP-A\tA-1\tTaak A\tC\t2026-01-01 08:00\t2026-01-01 16:00\t8\tEerste\u007f\u007ftweede',
  '%R\tSHARED\tP-B\tB-1\tTaak B\tC\t2026-01-01 08:00\t2026-01-01 16:00\t8\t',
  '%T\tACTVTYPE',
  '%F\tactv_code_type_id\tactv_code_type\tseq_num',
  '%R\tTYPE\tFase\t1',
  '%T\tACTVCODE',
  '%F\tactv_code_id\tactv_code_type_id\tshort_name\tseq_num',
  '%R\tV-A\tTYPE\tA\t1',
  '%R\tV-B\tTYPE\tB\t2',
  '%T\tTASKACTV',
  '%F\tproj_id\ttask_id\tactv_code_type_id\tactv_code_id',
  '%R\tP-A\tSHARED\tTYPE\tV-A',
  '%R\tP-B\tSHARED\tTYPE\tV-B',
  '%T\tUDFTYPE',
  '%F\tudf_type_id\ttable_name\tudf_type_label\tlogical_data_type',
  '%R\tUF\tTASK\tKeuze\tFT_STATICTYPE',
  '%T\tUDFVALUE',
  '%F\tudf_type_id\tproj_id\tfk_id\tudf_text',
  '%R\tUF\tP-A\tSHARED\tAlleen A',
  '%E',
].join('\n'));

const opened = readXER(source);
if (!isMultiDocumentImport(opened)) throw new Error('De X8-fixture moet via het X4b-meerdocumentpad lopen.');
const [a, b] = opened.results;

eq('1 activity-codekoppelingen worden op project en taak geprojecteerd zonder lekkage', [
  a?.tasks.find(task => task.id === 'SHARED')?.activityCodes,
  b?.tasks.find(task => task.id === 'SHARED')?.activityCodes,
], [{ TYPE: 'V-A' }, { TYPE: 'V-B' }]);
eq('2 FT_STATICTYPE wordt als tekstcustomfield alleen op de bedoelde taak gezet', [
  a?.customFieldDefs,
  a?.tasks.find(task => task.id === 'SHARED')?.customFields,
  b?.tasks.find(task => task.id === 'SHARED')?.customFields,
], [[{ id: 'UF', name: 'Keuze', type: 'text' }], { UF: 'Alleen A' }, undefined]);
eq('3 TASK.task_notes hergebruikt de DEL-DEL-decoder',
  a?.tasks.find(task => task.id === 'SHARED')?.notes,
  [{ id: 'xer-note:task:SHARED', text: 'Eerste\ntweede', done: false }]);
eq('4 bestandsbrede metadata-catalogus blijft één readonly bronobject voor X9',
  a?.xer?.metadata?.catalog === b?.xer?.metadata?.catalog, true);
eq('5 TASKACTV-telling pin: iedere geldige koppeling materialiseert precies eenmaal',
  [a, b].reduce((sum, result) => sum + result!.tasks.reduce(
    (taskSum, task) => taskSum + Object.keys(task.activityCodes ?? {}).length, 0), 0), 2);
const payloadA = payloadFromImport(a!, null);
const ifcA = readIFC(writeIFC(a!));
eq('6 documentcontract houdt de tijdelijke X8-broncatalogus vast',
  payloadA.xerImportMetadata?.metadata?.catalog === a?.xer?.metadata?.catalog, true);
eq('7 bestaande IFC-structuurroundtrip bewaart X8-definities, waarden en notities', {
  types: ifcA.activityCodeTypes,
  defs: ifcA.customFieldDefs,
  task: (() => { const task = ifcA.tasks.find(item => item.wbsCode === 'A-1'); return task && { activityCodes: task.activityCodes, customFields: task.customFields, notes: task.notes }; })(),
}, {
  types: [{ id: 'TYPE', name: 'Fase', values: [{ id: 'V-A', code: 'A' }, { id: 'V-B', code: 'B' }] }],
  defs: [{ id: 'UF', name: 'Keuze', type: 'text' }],
  task: { activityCodes: { TYPE: 'V-A' }, customFields: { UF: 'Alleen A' }, notes: [{ id: 'xer-note:task:SHARED', text: 'Eerste\ntweede', done: false }] },
});

if (diffs.length > 0) {
  console.error(`XX XER metadata-wiring: ${diffs.length} afwijking(en) (${checks} checks)`);
  for (const diff of diffs) console.error(`   ${diff}`);
  process.exitCode = 1;
} else {
  console.log(`OK XER metadata-wiring: ${checks} checks`);
}
