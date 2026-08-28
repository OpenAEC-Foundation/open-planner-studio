// X9 fixronde 2 — één echte twaalfprojectenketen door reader, store, IFC en headless recovery.
import { isMultiDocumentImport } from '@/services/importTypes';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { clearRecovery, fullRecoverySave, loadRecovery, saveRecovery } from '@/services/recovery/recoveryStore';
import { readXER } from '@/services/xer/xerReader';
import { decodeXerSourceArchive, sha256Hex } from '@/services/xerSourceArchive';
import { useAppStore } from '@/state/appStore';
import { recoveryInputFromParsed } from '@/state/documentContract';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';

declare const process: {
  exit(code: number): never;
  resourceUsage(): { maxRSS: number };
};

const failures: string[] = [];
let checks = 0;
const expect = (label: string, condition: boolean) => {
  checks += 1;
  if (!condition) failures.push(label);
};
const store = () => useAppStore.getState();

// Alleen de browseropslaggrens is gedubbeld; recoveryStore, IFC-writer/reader en restoreDocuments
// draaien echt. Browser/Tauri-UI en de tiensecondenhook blijven conform ruling X11.
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
      error: null,
      objectStore: () => ({
        getAll: () => {
          const request = { result: [] as unknown[], error: null, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
          queueMicrotask(() => { request.result = [...records.values()]; request.onsuccess?.(); });
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
    queueMicrotask(() => { request.onupgradeneeded?.(); request.onsuccess?.(); });
    return request;
  },
};

const projectRows: string[] = [];
const scheduleRows: string[] = [];
const taskRows: string[] = [];
const assignmentRows: string[] = [];
const codeRows: string[] = [];
const udfRows: string[] = [];
for (let index = 1; index <= 12; index += 1) {
  const suffix = String(index).padStart(2, '0');
  projectRows.push(`%R\tP-${suffix}\tProject ${suffix}\tC\t2026-08-${suffix} 08:00`);
  scheduleRows.push(`%R\tSO-${suffix}\tP-${suffix}\tY`);
  taskRows.push(`%R\tT-${suffix}\tP-${suffix}\t${suffix}-1\tTaak ${suffix}\tC\t2026-08-${suffix} 08:00\t2026-08-${suffix} 16:00\t8\tTT_Task\tDT_FixedDUR2\tTK_NotStart`);
  assignmentRows.push(`%R\tAS-${suffix}\tP-${suffix}\tT-${suffix}\tR-1\tMISSING-ROLE\t1\t8\t8`);
  codeRows.push(`%R\tP-${suffix}\tT-${suffix}\tTYPE\tV-${suffix}`);
  udfRows.push(`%R\tUF\tP-${suffix}\tT-${suffix}\tBron ${suffix}`);
}
const codeValues = Array.from({ length: 12 }, (_, offset) => {
  const suffix = String(offset + 1).padStart(2, '0');
  return `%R\tV-${suffix}\tTYPE\t${suffix}\t${offset + 1}`;
});
const source = new TextEncoder().encode([
  'ERMHDR\t23.12\t2026-08-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
  ...projectRows,
  '%T\tSCHEDOPTIONS',
  '%F\tschedoptions_id\tproj_id\tsched_use_expect_end_flag',
  ...scheduleRows,
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC\tStandaard\t8\t40\t',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\ttask_code\ttask_name\tclndr_id\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\ttask_type\tduration_type\tstatus_code',
  ...taskRows,
  '%T\tRSRC',
  '%F\trsrc_id\trsrc_name\trsrc_type\tclndr_id\tdef_qty_per_hr',
  '%R\tR-1\tVakman\tRT_Labor\tC\t1',
  '%T\tTASKRSRC',
  '%F\ttaskrsrc_id\tproj_id\ttask_id\trsrc_id\trole_id\ttarget_qty_per_hr\tremain_qty\ttarget_qty',
  ...assignmentRows,
  '%T\tACTVTYPE',
  '%F\tactv_code_type_id\tactv_code_type\tseq_num',
  '%R\tTYPE\tFase\t1',
  '%T\tACTVCODE',
  '%F\tactv_code_id\tactv_code_type_id\tshort_name\tseq_num',
  ...codeValues,
  '%T\tTASKACTV',
  '%F\tproj_id\ttask_id\tactv_code_type_id\tactv_code_id',
  ...codeRows,
  '%T\tUDFTYPE',
  '%F\tudf_type_id\ttable_name\tudf_type_label\tlogical_data_type',
  '%R\tUF\tTASK\tBronveld\tFT_STATICTYPE',
  '%T\tUDFVALUE',
  '%F\tudf_type_id\tproj_id\tfk_id\tudf_text',
  ...udfRows,
  '%E',
].join('\r\n'));

const opened = readXER(source);
if (!isMultiDocumentImport(opened)) throw new Error('Twaalfprojectenfixture opende niet als multi-document');
expect('1 echte XER-reader opent twaalf afzonderlijke projecten', opened.results.length === 12);
const initialArchive = opened.results[0]?.xerSourceArchive;
if (!initialArchive) throw new Error('Twaalfprojectenfixture mist bronarchief');
expect('2 alle readerresultaten delen één runtimearchive en één X5-filecache',
  new Set(opened.results.map(result => result.xerSourceArchive)).size === 1
  && new Set(opened.results.map(result => result.xer?.scheduleOptions.sourceArchive)).size === 1
  && opened.results.every(result => result.xer?.scheduleOptions.sourceArchive
    === initialArchive.readModel.scheduleOptionsSourceArchive));
expect('2a de echte fixture bevat per project niet-triviale assignment- én issueprovenance',
  opened.results.every(result => (result.xer?.resources?.assignments.length ?? 0) === 1
    && (result.xer?.resources?.issues.length ?? 0) >= 1));

store().newProject();
store().applyOpenedImport(opened, {
  filePath: null, fileHandle: null, recompute: false, fit: false,
  hourDataNotice: false, linkedOpen: false,
});
const twelve = store().getOpenDocumentPayloads();
expect('3 applyOpenedImport levert twaalf echte documenttabs', twelve.length === 12);
for (const document of twelve) store().switchDocument(document.id);
expect('4 documentwissel behoudt selector en exact hetzelfde archiveobject',
  store().xerSourceArchive === initialArchive && store().xerSourceProjectId === 'P-12');

const duplicateId = store().duplicateDocument('Project 12 duplicate');
for (let index = 0; index < 100; index += 1) store().setProject({ description: `keten-${index}` });
for (let index = 0; index < 100; index += 1) store().undo();
expect('5 honderd undo-stappen herstellen de documentspecifieke semantiek en houden archive-ref vast',
  store().project.description === '' && store().xerSourceArchive === initialArchive);
for (let index = 0; index < 100; index += 1) store().redo();
expect('6 honderd redo-stappen herstellen alleen de duplicate-semantiek', store().project.description === 'keten-99');
const thirteen = store().getOpenDocumentPayloads();
expect('7 twaalf projecten plus duplicate delen één archive/readmodel/catalogusgrafiek',
  thirteen.length === 13
  && new Set(thirteen.map(document => document.payload.xerSourceArchive)).size === 1
  && new Set(thirteen.map(document => document.payload.xerImportMetadata?.scheduleOptions.sourceArchive)).size === 1
  && new Set(thirteen.map(document => document.payload.xerImportMetadata?.resources?.catalog)).size === 1
  && new Set(thirteen.map(document => document.payload.xerImportMetadata?.metadata?.catalog)).size === 1);
expect('8 documentspecifieke semantiek blijft geïsoleerd van de duplicate',
  thirteen.find(document => document.id === duplicateId)?.payload.project.description === 'keten-99'
  && thirteen.filter(document => document.id !== duplicateId).every(document => document.payload.project.description === ''));

const ifcs = thirteen.map(document => writeIFC(buildWriteIFCInput(document.payload)));
const independentlyReopened = ifcs.map(ifc => readIFC(ifc));
expect('9 iedere zelfstandige IFC is zonder siblingstate heropenbaar met exacte bytes en SHA',
  independentlyReopened.every(result => result.xerSourceArchive !== undefined
    && sha256Hex(decodeXerSourceArchive(result.xerSourceArchive)) === initialArchive.sha256
    && result.xerSourceArchive.sha256 === initialArchive.sha256
    && result.xerSourceProjectId === result.xer?.sourceProjectId));

await clearRecovery();
await saveRecovery(fullRecoverySave(thirteen[0]!.id, thirteen.map((document, index) => ({
  id: document.id,
  ifc: ifcs[index]!,
  filePath: null,
  isDirty: true,
}))));
const loaded = await loadRecovery();
expect('10 headless recoveryStore laadt alle dertien zelfstandige IFC-snapshots', loaded.docs.length === 13);
const recoveryInputs = loaded.docs.map(document => recoveryInputFromParsed(
  readIFC(document.ifc),
  { id: document.id, filePath: null, isDirty: true },
));
store().restoreDocuments(recoveryInputs, duplicateId);
const recovered = store().getOpenDocumentPayloads();
const canonicalArchive = recovered[0]?.payload.xerSourceArchive;
expect('11 recovery canonicaliseert alle bytes en caches naar één runtimegrafiek',
  canonicalArchive !== null && canonicalArchive !== undefined
  && new Set(recovered.map(document => document.payload.xerSourceArchive)).size === 1
  && new Set(recovered.map(document => document.payload.xerImportMetadata?.scheduleOptions.sourceArchive)).size === 1
  && new Set(recovered.map(document => document.payload.xerImportMetadata?.resources?.catalog)).size === 1
  && new Set(recovered.map(document => document.payload.xerImportMetadata?.metadata?.catalog)).size === 1);
expect('12 recovery bindt assignment/issues en X5-bronrijen aan de canonieke selectorview',
  recovered.every(document => {
    const metadata = document.payload.xerImportMetadata;
    const selector = metadata?.sourceProjectId;
    const view = selector ? canonicalArchive?.diagnostics.documentViews[selector] : undefined;
    return metadata !== null && metadata.resources !== undefined && view?.resources !== undefined
      && metadata.resources.assignments === view.resources.assignments
      && metadata.resources.issues === view.resources.issues
      && metadata.scheduleOptions.sourceArchive === canonicalArchive?.readModel.scheduleOptionsSourceArchive
      && metadata.scheduleOptions.sourceRows.every((row, index) =>
        row === canonicalArchive?.readModel.scheduleOptionsSourceArchive.rows[
          metadata.scheduleOptions.sourceRowIndexes[index]!
        ]);
  }));
expect('13 recovery bewaart documentspecifieke semantiek en projectselectie',
  recovered.find(document => document.id === duplicateId)?.payload.project.description === 'keten-99'
  && recovered.filter(document => document.id !== duplicateId).every(document => document.payload.project.description === '')
  && new Set(recovered.map(document => document.payload.xerSourceProjectId)).size === 12);
await clearRecovery();

const peakRssKiB = process.resourceUsage().maxRSS;
expect('14 schaalproef rapporteert OS-gemeten peak RSS zonder absolute tijd- of groottelimiet',
  Number.isFinite(peakRssKiB) && peakRssKiB > 0);
console.log(`X9 12-project chain: peak-rss=${peakRssKiB}KiB; archives=${new Set(recovered.map(document => document.payload.xerSourceArchive)).size}; x5-caches=${new Set(recovered.map(document => document.payload.xerImportMetadata?.scheduleOptions.sourceArchive)).size}`);

if (failures.length === 0) {
  console.log(`OK  xer-source-archive-chain: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  xer-source-archive-chain: ${failures.length} afwijking(en) van ${checks}`);
for (const failure of failures) console.log(`   - ${failure}`);
process.exit(1);
