import { archiveDropped } from './xerArchiveFallbackAssert';
import { captureRecordedDates } from '@/engine/scheduler/recordedDates';
import { unrecordedExportGate } from '@/state/recordedDatesSelectors';
import type { RecordedTime } from '@/engine/scheduler/recordedDates';
import type { DocumentPayload } from '@/state/documentContract';
import { readXER } from '@/services/xer/xerReader';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { useAppStore } from '@/state/appStore';
import { recoveryInputFromParsed } from '@/state/documentContract';
import { clearRecovery, fullRecoverySave, loadRecovery, saveRecovery } from '@/services/recovery/recoveryStore';
import { readXerArchiveIFC } from './xerArchiveTestReader';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';

declare const process: {
  env: Record<string, string | undefined>;
  exit(code: number): never;
};

const failures: string[] = [];
let checks = 0;
const expect = (label: string, condition: boolean): void => {
  checks += 1;
  if (!condition) failures.push(label);
};
const eq = (label: string, got: unknown, want: unknown): void => {
  checks += 1;
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) failures.push(`${label}: verwacht ${b}, kreeg ${a}`);
};
const store = () => useAppStore.getState();

installFakeRecoveryIndexedDb();

const TASK_FIELDS = [
  'task_id', 'proj_id', 'clndr_id', 'task_code', 'task_name', 'task_type', 'duration_type',
  'status_code', 'target_drtn_hr_cnt', 'remain_drtn_hr_cnt', 'target_start_date', 'target_end_date',
  'early_start_date', 'early_end_date', 'late_start_date', 'late_end_date',
  'total_float_hr_cnt', 'free_float_hr_cnt',
].join('\t');

function fixtureBytes(mutate: boolean): Uint8Array {
  const r1LateStart = mutate ? '2026-01-19' : '2026-01-10';
  return new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC1\tStandaard 8u\tCA_Base\t8\t40\t',
    '%R\tC2\tKort 6u\tCA_Base\t6\t30\t',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP1\tRoundTripFixture\tC1\t2026-01-01\t2026-01-01',
    '%T\tTASK',
    `%F\t${TASK_FIELDS}`,
    `%R\tR1\tP1\tC1\tA1\tVolledig\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-02\t2026-01-09\t2026-01-05\t2026-01-12\t${r1LateStart}\t2026-01-17\t40\t8`,
    '%R\tR2\tP1\tC1\tA2\tKritiek\tTT_Task\tDT_FixedDUR\tTK_NotStart\t32\t32\t2026-02-02\t2026-02-06\t2026-02-02\t2026-02-06\t2026-02-02\t2026-02-06\t0\t0',
    '%R\tR3\tP1\tC1\tA3\tAlleenEarly\tTT_Task\tDT_FixedDUR\tTK_NotStart\t16\t16\t2026-03-02\t2026-03-04\t2026-03-02\t2026-03-04\t\t\t\t',
    '%R\tR4\tP1\tC2\tA4\tEigenKalender\tTT_Task\tDT_FixedDUR\tTK_NotStart\t12\t12\t2026-04-02\t2026-04-03\t2026-04-02\t2026-04-03\t\t\t6\t',
    '%R\tR5\tP1\tC1\tA5\tGeenEarly\tTT_Task\tDT_FixedDUR\tTK_NotStart\t32\t32\t2026-05-04\t2026-05-08\t\t\t\t\t\t',
    '%R\tR6\tP1\tC1\tA6\tFractie\tTT_Task\tDT_FixedDUR\tTK_NotStart\t8\t8\t2026-07-01\t2026-07-02\t2026-07-01\t2026-07-02\t\t\t4.01\t',
    '%E',
  ].join('\r\n'));
}

function single(bytes: Uint8Array): ImportResult {
  const opened = readXER(bytes);
  if (isMultiDocumentImport(opened)) throw new Error('Enkelprojectfixture opende als multi-document');
  return opened;
}

function modeSummary(payload: DocumentPayload): { origin: string | undefined; total: number; shifted: number; mode: boolean } {
  return {
    origin: payload.recordedDates?.origin,
    total: payload.recordedDates?.total ?? 0,
    shifted: payload.recordedDates?.shifted ?? 0,
    mode: payload.datesAsRecorded,
  };
}

const original = single(fixtureBytes(false));
const originalTimes = original.recordedTimes ?? {};
eq('1a bron levert vastlegging voor vijf van de zes taken', Object.keys(originalTimes).sort(), ['R1', 'R2', 'R3', 'R4', 'R6']);
eq('1b bron-origin is xer', original.recordedTimesOrigin, 'xer');
eq('1c R3 draagt alleen de early-as (late/float blijven undefined)', originalTimes.R3, {
  start: '2026-03-02', finish: '2026-03-04',
});
eq('1e R6 draagt een niet-ronde float (241 min / 480 min-per-dag)', originalTimes.R6?.totalFloat, 241 / 480);

store().newProject();
const applied = store().applyOpenedImport(original, {
  filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: false,
});
void applied;
const basePayload = store().getOpenDocumentPayloads()[0]!.payload;
expect('1d document draagt het XER-bronarchief en de selector',
  basePayload.xerSourceArchive !== null && basePayload.xerSourceProjectId === 'P1');
expect('1f een verse import met restverschillen opent al ín de modus (T4-beleid)',
  basePayload.datesAsRecorded === true);
eq('1g de vastlegging op het document draagt de VERSE-import-herkomst', basePayload.recordedDates?.origin, 'xer');
expect('1h het besluit is niet triviaal: deze fixture verschuift echt taken (aantal > 0)',
  (basePayload.recordedDates?.shifted ?? 0) > 0);

store().runCPM();
const outsidePayload = store().getOpenDocumentPayloads()[0]!.payload;
expect('2z runCPM verlaat de modus echt', outsidePayload.datesAsRecorded === false);
const ifcOutsideMode = writeIFC(buildWriteIFCInput(outsidePayload, 'planOnly'));
const reopenedOutside = readXerArchiveIFC(ifcOutsideMode);
eq('2a heropend IFC levert exact dezelfde vastlegging (alle zes assen, incl. de undefined-assen)',
  reopenedOutside.recordedTimes, originalTimes);
eq('2b heropend IFC draagt de HEROPEN-herkomst (niet "xer" — dit is een heropening, geen verse import)',
  reopenedOutside.recordedTimesOrigin, 'xer-archive');
eq('2c heropende taak-id\'s matchen de archiefrijen (OPS_TaskIdentity)',
  reopenedOutside.tasks.map(t => t.id).sort(), ['R1', 'R2', 'R3', 'R4', 'R5', 'R6']);
eq('2d captureRecordedDates levert identieke times vóór en ná de round-trip',
  captureRecordedDates(reopenedOutside.tasks, reopenedOutside.recordedFields, reopenedOutside.recordedTimes),
  captureRecordedDates(original.tasks, original.recordedFields, original.recordedTimes));
expect('2e de IFC-`recordedFields`-route wordt NIET gemengd met het bron-orakel',
  reopenedOutside.recordedFields !== undefined
  && captureRecordedDates(reopenedOutside.tasks, reopenedOutside.recordedFields).times.R5 !== undefined
  && captureRecordedDates(reopenedOutside.tasks, reopenedOutside.recordedFields, reopenedOutside.recordedTimes).times.R5 === undefined);

const ifcInMode = writeIFC(buildWriteIFCInput(basePayload, 'planOnly'));
const reopenedInMode = readXerArchiveIFC(ifcInMode);
eq('3a in de modus opgeslagen IFC levert dezelfde vastlegging', reopenedInMode.recordedTimes, originalTimes);
eq('3b in de modus opgeslagen IFC draagt de HEROPEN-herkomst', reopenedInMode.recordedTimesOrigin, 'xer-archive');
expect('3c de twee opslagvormen verschillen echt (anders bewijst 3a niets)',
  ifcInMode !== ifcOutsideMode);

expect('4z voorwaarde: de verse import is "ongewijzigd sinds import" en runCPM raakt dat niet',
  basePayload.importPristine === true && outsidePayload.importPristine === true);
expect('4y het buiten de modus opgeslagen IFC draagt de vlag als pset',
  ifcOutsideMode.includes("'OPS_ImportProvenance'") && reopenedOutside.importPristine === true);
store().newProject();
store().applyOpenedImport(reopenedOutside, {
  filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: false,
});
const reopenedOutsidePayload = store().getOpenDocumentPayloads()[0]!.payload;
expect('4a heropenen van een ongewijzigd, buiten-de-modus opgeslagen IFC gaat automatisch de modus in (optie B)',
  reopenedOutsidePayload.datesAsRecorded === true && reopenedOutsidePayload.recordedDates !== null
  && reopenedOutsidePayload.importPristine === true);

store().newProject();
store().applyOpenedImport(reopenedInMode, {
  filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: false,
});
const reopenedInModePayload = store().getOpenDocumentPayloads()[0]!.payload;
expect('4b heropenen van een ongewijzigd, ín-de-modus opgeslagen IFC gaat óók automatisch de modus in',
  reopenedInModePayload.datesAsRecorded === true && reopenedInModePayload.recordedDates !== null);

store().updateTask(store().tasks[0]!.id, { name: 'Bewerkt na import' });
const editedPayload = store().getOpenDocumentPayloads()[0]!.payload;
expect('4e één bewerking wist "ongewijzigd sinds import"', editedPayload.importPristine === false && editedPayload.isDirty === true);
const ifcEdited = writeIFC(buildWriteIFCInput(editedPayload, 'planOnly'));
expect('4f het bewerkte bestand draagt "ongewijzigd sinds import" niet meer', !ifcEdited.includes("'UnchangedSinceImport'"));
const reopenedEdited = readXerArchiveIFC(ifcEdited);
store().newProject();
store().applyOpenedImport(reopenedEdited, {
  filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: false,
});
const reopenedEditedPayload = store().getOpenDocumentPayloads()[0]!.payload;
expect('4g heropenen van een IN de modus opgeslagen, bewerkt IFC: weer in de modus, vlag blijft uit',
  reopenedEditedPayload.datesAsRecorded === true && reopenedEditedPayload.recordedDates !== null
  && reopenedEditedPayload.importPristine === false);
eq('4g2 …met hetzelfde aantal verschoven taken als de oorspronkelijke import',
  modeSummary(reopenedEditedPayload).shifted, modeSummary(basePayload).shifted);
eq('4h de vastlegging zelf is daarbij onveranderd (zelfde herkomst en zesassige inhoud)',
  [reopenedEdited.recordedTimesOrigin, reopenedEdited.recordedTimes], ['xer-archive', originalTimes]);
store().updateTask(store().tasks[0]!.id, { priority: store().tasks[0]!.priority + 1 });
expect('4i0 voorwaarde: de planningsbewerking verliet de modus', store().datesAsRecorded === false);
const ifcEditedOutside = writeIFC(buildWriteIFCInput(store().getOpenDocumentPayloads()[0]!.payload, 'planOnly'));
store().newProject();
store().applyOpenedImport(readXerArchiveIFC(ifcEditedOutside), {
  filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: false,
});
const reopenedEditedOutside = store().getOpenDocumentPayloads()[0]!.payload;
expect('4i buiten de modus opgeslagen, bewerkt IFC: geen modus, opgeslagen datums vergeten',
  reopenedEditedOutside.datesAsRecorded === false && reopenedEditedOutside.recordedDates === null
  && reopenedEditedOutside.importPristine === false);
eq('4c beide heropeningen komen op hetzelfde aantal verschoven taken uit als de oorspronkelijke import',
  modeSummary(reopenedInModePayload).shifted, modeSummary(basePayload).shifted);
eq('4d ... en dat geldt ook voor de buiten-de-modus-heropening',
  modeSummary(reopenedOutsidePayload).shifted, modeSummary(basePayload).shifted);

const ifcWithoutArchive = writeIFC({
  ...buildWriteIFCInput(basePayload, 'planOnly'),
  xer: undefined, xerSourceArchive: undefined, xerSourceProjectId: undefined,
});
const reopenedPlain = readXerArchiveIFC(ifcWithoutArchive);
expect('5a IFC zonder XER-archief levert geen recordedTimes; de herkomst is dan het eigen-IFC-spoor ("ifc-own", heropening)',
  reopenedPlain.recordedTimes === undefined && reopenedPlain.recordedTimesOrigin === 'ifc-own');
expect('5b de bestaande #63-IFC-route (recordedFields) werkt daar onveranderd',
  captureRecordedDates(reopenedPlain.tasks, reopenedPlain.recordedFields).total === reopenedPlain.tasks.length);

async function recoverSingleDocument(label: string, payload: DocumentPayload): Promise<DocumentPayload> {
  await clearRecovery();
  const ifc = writeIFC(buildWriteIFCInput(payload, 'planOnly'));
  await saveRecovery(fullRecoverySave('doc-1', [{ id: 'doc-1', ifc, filePath: null, isDirty: true, datesAsRecorded: payload.datesAsRecorded }]));
  const loaded = await loadRecovery();
  expect(`${label}: recoveryStore levert de snapshot terug`, loaded.docs.length === 1);
  const recoveredParsed = readXerArchiveIFC(loaded.docs[0]!.ifc);
  const input = recoveryInputFromParsed(recoveredParsed, {
    id: 'doc-1', filePath: null, isDirty: true,
    datesAsRecorded: loaded.docs[0]!.datesAsRecorded,
  });
  const result = store().restoreDocuments([input], 'doc-1');
  expect(`${label}: restoreDocuments slaagde zonder overgeslagen documenten`, result.skippedIds.length === 0);
  await clearRecovery();
  return store().getOpenDocumentPayloads()[0]!.payload;
}

const recoveredFromInMode = await recoverSingleDocument('6a', basePayload);
expect('6b hersteld document dat vóór de crash IN de modus stond, komt weer IN de modus terug (aan blijft aan)',
  recoveredFromInMode.datesAsRecorded === true);
eq('6c hersteld-in-modus document draagt dezelfde vastlegging als het gewone openen',
  recoveredFromInMode.recordedDates?.times, basePayload.recordedDates?.times);

const recoveredFromOutsideMode = await recoverSingleDocument('6d', outsidePayload);
expect('6e hersteld document dat vóór de crash UIT de modus stond, blijft UIT de modus (uit blijft uit)',
  recoveredFromOutsideMode.datesAsRecorded === false);
expect('6f ... en vergeet de opgeslagen datums (geen aanbod-stand meer, eigenaar 2026-10-17)',
  recoveredFromOutsideMode.recordedDates === null);

{
  store().newProject();
  store().applyOpenedImport(original, {
    filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: false,
  });
  expect('6h voorwaarde: de verse import opent ín de modus',
    store().getOpenDocumentPayloads()[0]!.payload.datesAsRecorded === true);
  const editId = store().tasks[0]!.id;
  const p6Start = store().tasks[0]!.time.earlyStart;
  store().updateTask(editId, { name: 'Hernoemd door gebruiker', priority: store().tasks[0]!.priority + 1 });
  const gap = store().getOpenDocumentPayloads()[0]!.payload;
  expect('6i voorwaarde: de bewerking verliet de modus en zette de planning op verouderd',
    gap.datesAsRecorded === false && gap.scheduleStale === true);
  expect('6j voorwaarde: maar `task.time` draagt nog P6\'s waarden (de herberekening is uitgesteld)',
    gap.tasks.find(task => task.id === editId)!.time.earlyStart === p6Start);

  const recoveredFromGap = await recoverSingleDocument('6k', gap);
  expect('6l herstel uit dat gat zet de modus NIET aan (de metadata zei uit, en dat telt)',
    recoveredFromGap.datesAsRecorded === false);
  expect('6m ... de bewerking zelf overleeft het herstel gewoon',
    recoveredFromGap.tasks.find(task => task.id === editId)?.name === 'Hernoemd door gebruiker');
  expect('6n ... en de opgeslagen datums zijn vergeten (geen aanbod-stand meer)',
    recoveredFromGap.recordedDates === null);
}

{
  store().newProject();
  store().applyOpenedImport(original, {
    filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: false,
  });
  const firstId = store().activeDocumentId!;
  store().newDocument();
  store().applyOpenedImport(original, {
    filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: false,
  });
  const secondId = store().activeDocumentId!;
  const before = store().getOpenDocumentPayloads();
  expect('6o voorwaarde: beide documenten staan ín de modus',
    before.length === 2 && before.every(document => document.payload.datesAsRecorded === true));

  await clearRecovery();
  await saveRecovery(fullRecoverySave(secondId, before.map(document => ({
    id: document.id,
    ifc: writeIFC(buildWriteIFCInput(document.payload, 'planOnly')),
    filePath: null,
    isDirty: true,
    datesAsRecorded: document.payload.datesAsRecorded,
  }))));
  const loadedTwo = await loadRecovery();
  expect('6p de recovery-metadata draagt de modusvlag voor BEIDE documenten',
    loadedTwo.docs.length === 2 && loadedTwo.docs.every(document => document.datesAsRecorded === true));
  const inputs = loadedTwo.docs.map(document => recoveryInputFromParsed(
    readXerArchiveIFC(document.ifc),
    { id: document.id, filePath: null, isDirty: true, datesAsRecorded: document.datesAsRecorded },
  ));
  store().restoreDocuments(inputs, secondId);
  await clearRecovery();

  const restoredById = new Map(store().getOpenDocumentPayloads().map(d => [d.id, d.payload]));
  const actief = restoredById.get(secondId);
  const slapend = restoredById.get(firstId);
  expect('6q het ACTIEVE herstelde document staat weer in de modus',
    actief?.datesAsRecorded === true && actief?.scheduleStale === false);
  expect('6r het SLAPENDE herstelde document staat óók weer in de modus',
    slapend?.datesAsRecorded === true);
  expect('6s ... en is dus niet als "verouderd" gemarkeerd (de invariant modus-aan-én-verouderd)',
    slapend?.scheduleStale === false);
  expect('6t ... met een cpmResult uit de vastlegging, niet uit een solve (geen lege planning)',
    slapend?.cpmResult !== null);
  expect('6v het SLAPENDE herstelde document draagt zijn vastlegging, zonder verzonnen teller',
    slapend?.recordedDates !== null && slapend?.recordedDates?.shifted === undefined
      && slapend?.recordedDates?.origin === 'xer-archive'
      && Object.keys(slapend?.recordedDates?.times ?? {}).length === Object.keys(originalTimes).length);
  expect('6w ... zodat de export-poort ook dáár actief is (geen verzonnen speling naar CSV/MCP)',
    slapend !== undefined && unrecordedExportGate(slapend.recordedDates, slapend.datesAsRecorded) !== undefined);
  eq('6u ... en met P6\'s datums nog ín de vastgelegde taken',
    Object.fromEntries((slapend?.tasks ?? [])
      .filter(task => originalTimes[task.id] !== undefined)
      .map(task => [task.id, task.time.earlyStart])),
    Object.fromEntries(Object.entries(basePayload.recordedDates!.times).map(([id, time]) => [id, time.start])));

  store().closeDocument(firstId);
  expect('6v opruimen: er blijft één document open voor de volgende secties',
    store().getOpenDocumentPayloads().length === 1);
}

function chainOf(mutate: boolean): { times: Record<string, RecordedTime>; cpm: string } {
  const parsed = single(fixtureBytes(mutate));
  store().newProject();
  store().applyOpenedImport(parsed, {
    filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: false,
  });
  const payload = store().getOpenDocumentPayloads()[0]!.payload;
  const reopened = readXerArchiveIFC(writeIFC(buildWriteIFCInput(payload, 'planOnly')));
  store().newProject();
  store().applyOpenedImport(reopened, {
    filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: false,
  });
  store().runCPM();
  const result = store().cpmResult;
  const cpm = JSON.stringify({
    tasks: [...(result?.tasks ?? new Map())].sort(([a], [b]) => a.localeCompare(b)),
    criticalPath: [...(result?.criticalPath ?? [])].sort(),
    projectEnd: result?.projectEnd ?? null,
    projectDuration: result?.projectDuration ?? null,
    times: store().tasks.map(t => [t.id, t.time]).sort(),
  });
  return { times: reopened.recordedTimes ?? {}, cpm };
}
const clean = chainOf(false);
const mutated = chainOf(true);
eq('7a de gemuteerde orakelcel komt exact op zijn as terug ná de volledige IFC-keten',
  mutated.times.R1?.lateStart, '2026-01-19');
eq('7b geen enkele andere as van R1 schuift mee',
  { ...mutated.times.R1, lateStart: clean.times.R1?.lateStart }, clean.times.R1);
eq('7c alle overige taken blijven identiek',
  { ...mutated.times, R1: null }, { ...clean.times, R1: null });
eq('7d het cpmResult ná runCPM is byte-gelijk — de gemuteerde P6-uitvoer raakt de solve niet',
  mutated.cpm, clean.cpm);

const chunkMatch = /IFCPROPERTYSINGLEVALUE\('ByteChunk000000',\$,IFCTEXT\('([A-Za-z0-9+/=]+)'\)/.exec(ifcOutsideMode);
expect('8a de fixture-IFC draagt een leesbare archiefchunk', chunkMatch !== null);
if (chunkMatch) {
  const chunk = chunkMatch[1]!;
  const flipped = (chunk[0] === 'A' ? 'B' : 'A') + chunk.slice(1);
  const tampered = ifcOutsideMode.replace(`IFCTEXT('${chunk}')`, `IFCTEXT('${flipped}')`);
  const verdict = archiveDropped(() => readXerArchiveIFC(tampered), { code: 'hash-mismatch' });
  expect(`8b een gemanipuleerde archiefchunk levert geen vastlegging meer op (archief weg, hash-mismatch) i.p.v. stil anders gelezen${verdict.ok ? '' : ` — ${verdict.why}`}`, verdict.ok);
}

const twoProjectBytes = new TextEncoder().encode([
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tStandaard 8u\tCA_Base\t8\t40\t',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
  '%R\tPA\tProjectA\tC1\t2026-01-01\t2026-01-01',
  '%R\tPB\tProjectB\tC1\t2026-01-01\t2026-01-01',
  '%T\tTASK',
  `%F\t${TASK_FIELDS}`,
  '%R\tA1\tPA\tC1\tAA1\tA-een\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-02\t2026-01-09\t2026-01-05\t2026-01-12\t2026-01-10\t2026-01-17\t40\t8',
  '%R\tB1\tPB\tC1\tBB1\tB-een\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-06-01\t2026-06-08\t2026-06-02\t2026-06-09\t2026-06-04\t2026-06-11\t16\t0',
  '%E',
].join('\r\n'));
const twoProject = readXER(twoProjectBytes);
expect('9a tweeprojectenfixture opent als multi-document', isMultiDocumentImport(twoProject));
if (isMultiDocumentImport(twoProject)) {
  store().newProject();
  store().applyOpenedImport(twoProject, {
    filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: false,
  });
  const docs = store().getOpenDocumentPayloads();
  eq('9b twee documenten geopend', docs.length, 2);
  for (const doc of docs) {
    const selector = doc.payload.xerSourceProjectId!;
    const before = twoProject.results.find(r => r.xer?.sourceProjectId === selector)!;
    const after = readXerArchiveIFC(writeIFC(buildWriteIFCInput(doc.payload, 'planOnly')));
    eq(`9c ${selector} — heropend document krijgt de vastlegging van zijn EIGEN project`,
      after.recordedTimes, before.recordedTimes);
    eq(`9d ${selector} — en uitsluitend zijn eigen taak-id`,
      Object.keys(after.recordedTimes ?? {}), [selector === 'PA' ? 'A1' : 'B1']);
  }
}

const CORPUS = process.env.OPS_XER_CORPUS;

function findFile(dir: string, name: string): string | null {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(full, name);
      if (found) return found;
    } else if (entry.name === name) {
      return full;
    }
  }
  return null;
}

function corpusRoundTrip(label: string, path: string): void {
  const t0 = Date.now();
  const opened = readXER(new Uint8Array(readFileSync(path)));
  const parsed = isMultiDocumentImport(opened) ? opened.results[opened.activeDocumentIndex]! : opened;
  const tRead = Date.now();
  store().newProject();
  store().applyOpenedImport(parsed, {
    filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: false,
  });
  const payload = store().getOpenDocumentPayloads().find(d => d.payload.xerSourceProjectId === parsed.xer?.sourceProjectId)!.payload;
  const ifc = writeIFC(buildWriteIFCInput(payload, 'planOnly'));
  const tWrite = Date.now();
  const reopened = readXerArchiveIFC(ifc);
  const tReopen = Date.now();
  eq(`C-${label} vastlegging identiek na opslaan+heropenen`, reopened.recordedTimes, parsed.recordedTimes);
  eq(`C-${label} herkomst is de HEROPEN-vorm (niet gelijk aan de verse-importherkomst)`,
    reopened.recordedTimesOrigin, 'xer-archive');
  expect(`C-${label} de vastlegging is niet leeg (anders bewijst de gelijkheid niets)`,
    Object.keys(reopened.recordedTimes ?? {}).length > 0);
  console.log(`.   xer-recorded-roundtrip: ${label} — taken=${parsed.tasks.length}`
    + ` vastgelegd=${Object.keys(parsed.recordedTimes ?? {}).length}`
    + ` ifc=${(ifc.length / 1024 / 1024).toFixed(1)}MiB`
    + ` lees=${tRead - t0}ms store+schrijf=${tWrite - tRead}ms heropen=${tReopen - tWrite}ms`);
}

if (!CORPUS) {
  console.log('OK  xer-recorded-roundtrip: corpus niet aanwezig (OPS_XER_CORPUS) — corpuspoort overgeslagen');
} else if (!existsSync(CORPUS)) {
  expect('xer-recorded-roundtrip: OPS_XER_CORPUS wijst naar een bestaande map', false);
} else {
  const p6diff = join(CORPUS, 'crawl-xer', 'p6diff-baseline.xer');
  if (existsSync(p6diff)) corpusRoundTrip('p6diff-baseline.xer', p6diff);
  else expect(`xer-recorded-roundtrip: ${p6diff} bestaat`, false);

  const rehab = findFile(CORPUS, 'rehab-2.xer');
  if (rehab) corpusRoundTrip('rehab-2.xer', rehab);
  else expect('xer-recorded-roundtrip: rehab-2.xer gevonden in OPS_XER_CORPUS', false);
}

if (failures.length === 0) {
  console.log(`OK  xer-recorded-roundtrip: alle checks groen (${checks})`);
} else {
  console.log(`XX  xer-recorded-roundtrip: ${failures.length} afwijking(en) van ${checks}`);
  for (const failure of failures) console.log(`   XX ${failure}`);
  process.exit(1);
}
