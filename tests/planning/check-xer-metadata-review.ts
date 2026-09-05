import { isMultiDocumentImport } from '@/services/importTypes';
import { buildXerMetadataCatalog, materializeXerMetadata } from '@/services/xer/xerMetadata';
import { readXER } from '@/services/xer/xerReader';
import { parseXerTables } from '@/services/xer/xerTables';
import { createAppStore } from '@/state/appStore';

const rows = [
  'ERMHDR\t23.12', '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tsum_base_proj_id',
  '%R\tMAIN\tMain\tC\tBASE', '%R\tBASE\tBaseline\tC\t', '%R\tOTHER\tOther\tC\t',
  '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt', '%R\tC\tStandaard\t8\t40',
  '%T\tTASK', '%F\ttask_id\tproj_id\ttask_code\ttask_name\tclndr_id\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\ttask_notes',
  '%R\tSHARED\tMAIN\tM\tMain task\tC\t2026-01-01\t2026-01-02\t8\tTaak\u007f\u007fnoot',
  '%R\tSHARED\tBASE\tB\tBase task\tC\t2026-01-01\t2026-01-02\t8\t',
  '%R\tSHARED\tOTHER\tO\tOther task\tC\t2026-01-01\t2026-01-02\t8\t',
  '%T\tACTVTYPE', '%F\tactv_code_type_id\tactv_code_type\tseq_num', '%R\tTYPE\tFase\t2', '%R\tTYPE\tDubbel\t1',
  '%T\tACTVCODE', '%F\tactv_code_id\tactv_code_type_id\tshort_name', '%R\tVM\tTYPE\tM', '%R\tVB\tTYPE\tB', '%R\tVO\tTYPE\tO',
  '%T\tTASKACTV', '%F\tproj_id\ttask_id\tactv_code_type_id\tactv_code_id',
  '%R\tMAIN\tSHARED\tTYPE\tVM', '%R\tMAIN\tSHARED\tTYPE\tVM', '%R\tBASE\tSHARED\tTYPE\tVB', '%R\tOTHER\tSHARED\tTYPE\tVO',
  '%T\tUDFTYPE', '%F\tudf_type_id\ttable_name\tudf_type_label\tlogical_data_type',
  '%R\tUT\tTASK\tTekst\tFT_TEXT', '%R\tUT\tTASK\tDubbel\tFT_TEXT', '%R\tUW\tWBS\tWBS tekst\tFT_TEXT', '%R\tUX\tTASK\tOnbekend\tFT_MYSTERY',
  '%T\tUDFVALUE', '%F\tudf_type_id\tproj_id\tfk_id\tudf_text',
  '%R\tUT\tMAIN\tSHARED\tZ', '%R\tUT\tMAIN\tSHARED\tA', '%R\tUT\tBASE\tSHARED\tBase', '%R\tUT\tOTHER\tSHARED\tOther',
  '%R\tUT\t\tSHARED\tAmbiguous', '%R\tUT\tMAIN\tMISSING\tDangling', '%R\tUW\tMAIN\tW1\tUitgesteld', '%R\tUX\tMAIN\tSHARED\tOnbekend',
  '%T\tMEMOTYPE', '%F\tmemo_type_id\tmemo_type', '%R\tMT\tMemo',
  '%T\tTASKMEMO', '%F\tmemo_id\tproj_id\ttask_id\tmemo_type_id\ttask_memo\tseq_num', '%R\tMM\tMAIN\tSHARED\tMT\tMemo\u007f\u007ftekst\t1',
  '%E',
];
const opened = readXER(new TextEncoder().encode(rows.join('\n')));
if (!isMultiDocumentImport(opened)) throw new Error('reviewfixture moet MAIN en OTHER openen');
const main = opened.results.find(result => result.project.id === 'MAIN')!;
const other = opened.results.find(result => result.project.id === 'OTHER')!;
const catalog = main.xer?.metadata?.catalog;
if (!catalog) throw new Error('reviewfixture mist de X8-broncatalogus');
const diffs: string[] = []; let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => { checks++; if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: ${JSON.stringify(got)} != ${JSON.stringify(want)}`); };
eq('MAIN/BASE/OTHER selectie', opened.results.map(result => result.project.id).sort(), ['MAIN', 'OTHER']);
eq('zelfde task_id lekt niet', [main.tasks[0]?.activityCodes, other.tasks[0]?.activityCodes], [{ TYPE: 'VM' }, { TYPE: 'VO' }]);
eq('baselineprojectie blijft catalogusdata', catalog.taskProjectionsByProject.BASE?.[0]?.activityCodes, { TYPE: 'VB' });
eq('task_notes heeft precedence vóór memo en beide DEL-DEL', main.tasks[0]?.notes?.map(note => note.text), ['Taak\nnoot', 'Memo\ntekst']);
eq('duplicate UDF kiest deterministisch lexicografisch', main.tasks[0]?.customFields, { UT: 'A' });
eq('diagnostiek onderscheidt reviewtakken', {
  duplicateType: catalog.issueCounts.XER_ACTIVITY_CODE_DUPLICATE_TYPE_ID,
  duplicateLink: catalog.issueCounts.XER_ACTIVITY_CODE_DUPLICATE_LINK,
  duplicateUdfType: catalog.issueCounts.XER_UDF_DUPLICATE_TYPE_ID,
  duplicateUdfValue: catalog.issueCounts.XER_UDF_DUPLICATE_VALUE,
  deferred: catalog.issueCounts.XER_UDF_DEFERRED_ENTITY,
  unknown: catalog.issueCounts.XER_UDF_UNKNOWN_DATA_TYPE,
  dangling: catalog.issueCounts.XER_UDF_DANGLING_ENTITY,
  ambiguous: catalog.issueCounts.XER_UDF_AMBIGUOUS_TASK,
}, { duplicateType: 1, duplicateLink: 1, duplicateUdfType: 1, duplicateUdfValue: 1, deferred: 1, unknown: 1, dangling: 1, ambiguous: 1 });
eq('catalogus diep immutable', [Object.isFrozen(catalog), Object.isFrozen(catalog.taskProjectionsByProject.MAIN), Object.isFrozen(catalog.sourceData.TASKACTV)], [true, true, true]);

const store = createAppStore();
store.getState().applyLoadedProject(main, { filePath: null, fileHandle: null, recompute: false, fit: false, hourDataNotice: false, linkedOpen: true });
const sourceId = store.getState().activeDocumentId; const sharedCatalog = store.getState().xerImportMetadata!.metadata!.catalog;
const copyId = store.getState().duplicateDocument('kopie');
store.getState().updateTask('SHARED', { activityCodes: { TYPE: 'VO' }, customFields: { UT: 'Mutatie' }, notes: [{ id: 'mut', text: 'Mutatie', done: false }] });
eq('mutable domeinview verandert zonder catalogusmutatie', [store.getState().tasks[0]?.customFields, sharedCatalog.taskProjectionsByProject.MAIN[0]?.customFields, store.getState().xerImportMetadata!.metadata!.catalog === sharedCatalog], [{ UT: 'Mutatie' }, { UT: 'A' }, true]);
store.getState().undo();
eq('undo herstelt mutable domeinview', [store.getState().tasks[0]?.activityCodes, store.getState().tasks[0]?.customFields, store.getState().tasks[0]?.notes?.map(note => note.text)], [{ TYPE: 'VM' }, { UT: 'A' }, ['Taak\nnoot', 'Memo\ntekst']]);
store.getState().switchDocument(sourceId);
eq('switch terug naar bron blijft geïsoleerd', [store.getState().activeDocumentId === sourceId, store.getState().tasks[0]?.customFields, store.getState().xerImportMetadata!.metadata!.catalog === sharedCatalog], [true, { UT: 'A' }, true]);
store.getState().switchDocument(copyId);
eq('switch naar kopie na undo blijft geïsoleerd', [store.getState().tasks[0]?.customFields, store.getState().xerImportMetadata!.metadata!.catalog === sharedCatalog], [{ UT: 'A' }, true]);

// Notitiecontract: TASK.task_notes heeft vaste voorrang, gevolgd door alle TASKNOTE-rijen in
// bronvolgorde en daarna alle TASKMEMO-rijen in bronvolgorde. Geen van de drie lagen dedupliceert
// inhoud of id's stil; een duplicate memo-id blijft een diagnose én een afzonderlijke notitie.
const noteRows = [
  'ERMHDR\t23.12',
  '%T\tTASK', '%F\ttask_id\tproj_id\ttask_code\ttask_notes',
  '%R\tT\tP1\tP1-T\tTaak\u007f\u007fnoot', '%R\tT\tP2\tP2-T\t', '%R\tU\tP1\tP1-U\t',
  '%T\tTASKNOTE', '%F\ttask_id\tproj_id\ttask_notes',
  '%R\tT\tP1\tEerste\u007f\u007fTASKNOTE', '%R\tT\tP1\tEerste\u007f\u007fTASKNOTE', '%R\tT\tP1\tTweede TASKNOTE',
  '%R\tMISSING\tP1\tDangling TASKNOTE', '%R\tT\t\tAmbigue TASKNOTE',
  '%T\tMEMOTYPE', '%F\tmemo_type_id\tmemo_type', '%R\tMT\tMemo',
  '%T\tTASKMEMO', '%F\tmemo_id\tproj_id\ttask_id\tmemo_type_id\ttask_memo',
  '%R\tDUP\tP1\tT\tMT\tEerste memo', '%R\tDUP\tP1\tT\tMT\tTweede memo', '%R\tMISSINGTYPE\tP1\tT\tUNKNOWN\tMemo zonder type',
  '%R\tDANGLINGTASK\tP1\tMISSING\tMT\tDangling memo', '%R\tAMBIGUOUS\t\tT\tMT\tAmbigue memo',
  '%E',
];
const noteTables = parseXerTables(new TextEncoder().encode(noteRows.join('\n')));
const noteCatalog = buildXerMetadataCatalog(noteTables);
const noteView = materializeXerMetadata(noteCatalog, 'P1');
const noteSourceData = noteCatalog.sourceData;
const noteCounts = noteCatalog.issueCounts;
eq('TASKNOTE blijft zero-copy in de catalogus en bewaart elke bronrij', {
  raw: noteTables.tables.get('TASKNOTE')?.rows.length ?? 0,
  catalog: noteSourceData.TASKNOTE?.length ?? 0,
  shared: noteSourceData.TASKNOTE === noteTables.tables.get('TASKNOTE')?.rows,
  frozen: [
    Object.isFrozen(noteSourceData.TASKNOTE),
    Object.isFrozen(noteSourceData.TASKNOTE[0]),
    Object.isFrozen(noteSourceData.TASKNOTE[0]?.cells),
  ],
}, { raw: 5, catalog: 5, shared: true, frozen: [true, true, true] });
eq('notities volgen task-notes, TASKNOTE-bronvolgorde en TASKMEMO-bronvolgorde zonder verlies',
  noteView.taskMetadata.get('T')?.notes?.map(note => note.text),
  ['Taak\nnoot', 'Eerste\nTASKNOTE', 'Eerste\nTASKNOTE', 'Tweede TASKNOTE', 'Eerste memo', 'Tweede memo', 'Memo zonder type']);
eq('dezelfde notitietekst en duplicate memo-id blijven afzonderlijke bronnen', {
  uniqueIds: new Set(noteView.taskMetadata.get('T')?.notes?.map(note => note.id)).size,
  count: noteView.taskMetadata.get('T')?.notes?.length,
}, { uniqueIds: 7, count: 7 });
eq('notitiediagnostiek onderscheidt duplicate memo-id, ontbrekend memotype, dangling en ambigu taak-id', {
  duplicateMemo: noteCounts.XER_NOTE_DUPLICATE_MEMO_ID,
  danglingMemoType: noteCounts.XER_NOTE_DANGLING_MEMO_TYPE,
  danglingTask: noteCounts.XER_NOTE_DANGLING_TASK,
  ambiguousTask: noteCounts.XER_NOTE_AMBIGUOUS_TASK,
}, { duplicateMemo: 1, danglingMemoType: 1, danglingTask: 2, ambiguousTask: 2 });

if (diffs.length) { console.error(`XX X8 reviewerprobes (${checks})\n${diffs.join('\n')}`); process.exitCode = 1; }
else console.log(`OK X8 reviewerprobes (${checks} checks)`);
