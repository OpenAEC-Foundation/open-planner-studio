/**
 * T5 (XER-etappeplan laag 3, §3.8) — "datums zoals opgeslagen" overleeft een IFC-opslag, een
 * heropening en het crashherstel.
 *
 * WAT DIT BEWIJST
 *  1. XER openen → IFC opslaan → heropenen levert EXACT dezelfde `recordedTimes` op — alle zes
 *     assen, inclusief de `undefined`s ("niet vastgelegd" blijft niet-vastgelegd, wordt nooit een
 *     verzonnen 0 of een kopie van de vroege kant).
 *  2. Dat geldt zowel wanneer er ÍN de modus wordt opgeslagen (P6's waarden staan dan in
 *     `task.time`, zie `applyRecordedTimesToTasks`) als daarbuiten (onze herberekening staat er).
 *     De vastlegging hangt aan de BRON, niet aan wat er toevallig in `task.time` stond.
 *  3. HEROPEN-BELEID (orkestratorbesluit, 2026-09-05): een VERSE XER-import met restverschillen
 *     zet de modus zelf meteen aan (`recordedTimesOrigin === 'xer'`, taak T4). Een HEROPENDE IFC
 *     met XER-archief krijgt altijd `recordedTimesOrigin === 'xer-archive'` en de modus NOOIT
 *     automatisch — ongeacht of het bestand ín of buiten de modus werd opgeslagen — en biedt hem
 *     alleen aan (het gewone #63-gedrag). Reden: een sindsdien bewerkte en opgeslagen planning mag
 *     bij heropenen niet stilzwijgend P6's oude datums tonen.
 *  4. Een IFC ZONDER XER-archief blijft byte-identiek: geen `recordedTimes`, geen origin, en de
 *     bestaande #63-IFC-route (`recordedFields`) doet onveranderd zijn werk.
 *  5. CRASHHERSTEL IS GEEN HEROPENING: `restoreDocuments` leest de modusvlag van vóór de crash als
 *     FEIT uit het recovery-manifest (v4, `RecoveryDocInput.datesAsRecorded` →
 *     `applyRecordedDatesOnLoad(..., restoredMode)` voor het actieve, `applyRestoredRecordedMode`
 *     voor een slapend document) — aan blijft aan, uit blijft uit — zonder opnieuw op
 *     `recordedTimesOrigin` te beslissen (dat zou voor elk XER-archiefdocument altijd "alleen
 *     aanbieden" zijn, zie punt 3).
 *  6. MUTATIEBEWIJS: één gewijzigde orakelcel in de bron verplaatst de vastlegging over de hele
 *     keten heen WÉL, maar het `cpmResult` ná `runCPM` GEEN millimeter.
 *  7. Hardening: de sha256-poort op het archief geldt ook voor de vastlegging — een gemanipuleerde
 *     archiefchunk wordt geweigerd in plaats van stil een andere vastlegging op te leveren.
 *
 * Deze check leest de ECHTE productiebeslissing (`payload.datesAsRecorded` +
 * `payload.recordedDates`) rechtstreeks van de store af — geen losse `modeVerdict`-spiegeling meer
 * van de beslisregel, want die zou na taak T5 opnieuw moeten weten dat `applyLoadedProject` en
 * `restoreDocuments` verschillende paden bewandelen (`applyRecordedDatesOnLoad` zonder resp. mét
 * `restoredMode`, plus `applyRestoredRecordedMode` voor slapende documenten). Rechtstreeks aflezen
 * toetst dus de werkelijke bedrading, niet een kopie ervan.
 */
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

// ── Headless browseropslag-dubbel voor recoveryStore (identiek aan check-xer-source-archive-chain) ──
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

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Corpusloze fixture — DAGMODUS met twee kalenders (8u en 6u per dag), zodat de uren→dagen-
// omrekening van de float (incl. een niet-ronde uitkomst) door de hele keten heen wordt getoetst.
// UURMODUS staat hier bewust NIET in: het corpusdeel onderaan dekt die as met echte bestanden —
// gemeten 2026-09-05 zijn álle 6.976 vastgelegde instants van `rehab-2.xer` en alle 8 van
// `p6diff-baseline.xer` uurmodus-instants (`YYYY-MM-DDTHH:mm`), dus de dag/uur-representatie over
// de round-trip heen wordt daar wél bewezen. Claim hier dus niets meer dan de fixture waarmaakt.
// ═════════════════════════════════════════════════════════════════════════════════════════════
const TASK_FIELDS = [
  'task_id', 'proj_id', 'clndr_id', 'task_code', 'task_name', 'task_type', 'duration_type',
  'status_code', 'target_drtn_hr_cnt', 'remain_drtn_hr_cnt', 'target_start_date', 'target_end_date',
  'early_start_date', 'early_end_date', 'late_start_date', 'late_end_date',
  'total_float_hr_cnt', 'free_float_hr_cnt',
].join('\t');

/** `mutate: true` verandert precies ÉÉN orakelcel: `late_start_date` van R1 (2026-01-10 → 2026-01-19).
 *  Verder is het bestand byte-voor-byte gelijk — het mutatiebewijs mag geen tweede verschil kennen. */
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
    // R1 — alle zes assen gevuld; late_start_date is de gemuteerde cel.
    `%R\tR1\tP1\tC1\tA1\tVolledig\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-02\t2026-01-09\t2026-01-05\t2026-01-12\t${r1LateStart}\t2026-01-17\t40\t8`,
    // R2 — kritiek (float 0) op de projectkalender.
    '%R\tR2\tP1\tC1\tA2\tKritiek\tTT_Task\tDT_FixedDUR\tTK_NotStart\t32\t32\t2026-02-02\t2026-02-06\t2026-02-02\t2026-02-06\t2026-02-02\t2026-02-06\t0\t0',
    // R3 — ALLEEN de early-as: late/float ontbreken. Dit is de taak die bewijst dat "niet
    // vastgelegd" een undefined blijft over de hele IFC-keten heen.
    '%R\tR3\tP1\tC1\tA3\tAlleenEarly\tTT_Task\tDT_FixedDUR\tTK_NotStart\t16\t16\t2026-03-02\t2026-03-04\t2026-03-02\t2026-03-04\t\t\t\t',
    // R4 — eigen kalender C2 (6u/dag): 6u float ⇒ exact 1,0 dag. Bewijst dat de TAAK-effectieve
    // kalender de omrekening stuurt, óók ná de round-trip.
    '%R\tR4\tP1\tC2\tA4\tEigenKalender\tTT_Task\tDT_FixedDUR\tTK_NotStart\t12\t12\t2026-04-02\t2026-04-03\t2026-04-02\t2026-04-03\t\t\t6\t',
    // R5 — geen enkele early-as ⇒ GEEN uitspraak, ook niet ná een round-trip (geen terugval op
    // target_*, en de IFC-`recordedFields`-route mag hem er ook niet alsnog in schuiven).
    '%R\tR5\tP1\tC1\tA5\tGeenEarly\tTT_Task\tDT_FixedDUR\tTK_NotStart\t32\t32\t2026-05-04\t2026-05-08\t\t\t\t\t\t',
    // R6 — niet-ronde float: Math.round(4.01u × 60) = 241 min / 480 min-per-dag. Een keten die de
    // vastlegging ergens door een dag- of getalafronding haalt, valt hierop om.
    '%R\tR6\tP1\tC1\tA6\tFractie\tTT_Task\tDT_FixedDUR\tTK_NotStart\t8\t8\t2026-07-01\t2026-07-02\t2026-07-01\t2026-07-02\t\t\t4.01\t',
    '%E',
  ].join('\r\n'));
}

function single(bytes: Uint8Array): ImportResult {
  const opened = readXER(bytes);
  if (isMultiDocumentImport(opened)) throw new Error('Enkelprojectfixture opende als multi-document');
  return opened;
}

/** Leest de ECHTE productiebeslissing van een document af — geen recomputatie, gewoon de velden
 *  die `applyRecordedDatesOnLoad`/`applyRestoredRecordedMode` op de payload zetten. */
function modeSummary(payload: DocumentPayload): { origin: string | undefined; total: number; shifted: number; mode: boolean } {
  return {
    origin: payload.recordedDates?.origin,
    total: payload.recordedDates?.total ?? 0,
    shifted: payload.recordedDates?.shifted ?? 0,
    mode: payload.datesAsRecorded,
  };
}

// ── 1. Basislijn: het oorspronkelijke openen ─────────────────────────────────────────────────
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
  filePath: null, fileHandle: null, recompute: true, fit: false, hourDataNotice: false, linkedOpen: false,
});
void applied;
const basePayload = store().getOpenDocumentPayloads()[0]!.payload;
expect('1d document draagt het XER-bronarchief en de selector',
  basePayload.xerSourceArchive !== null && basePayload.xerSourceProjectId === 'P1');
// Heropen-beleid (taak T4): een VERSE import met restverschillen zet de modus zelf meteen aan —
// `basePayload` staat hierdoor AL in de modus (P6's waarden staan al in `task.time`). Sectie 3
// hergebruikt dat rechtstreeks in plaats van de modus handmatig te reconstrueren.
expect('1f een verse import met restverschillen opent al ín de modus (T4-beleid)',
  basePayload.datesAsRecorded === true);
eq('1g de vastlegging op het document draagt de VERSE-import-herkomst', basePayload.recordedDates?.origin, 'xer');
expect('1h het besluit is niet triviaal: deze fixture verschuift echt taken (aantal > 0)',
  (basePayload.recordedDates?.shifted ?? 0) > 0);

// ── 2. Opslaan BUITEN de modus: `task.time` draagt onze herberekening ────────────────────────
// De modus verlaten is een gewone mutator (`runCPM`, hetzelfde pad als F5) — zo komt de
// "buiten de modus"-toestand tot stand zoals een gebruiker hem ook zou bereiken, in plaats van
// hem handmatig te reconstrueren.
store().runCPM();
const outsidePayload = store().getOpenDocumentPayloads()[0]!.payload;
expect('2z runCPM verlaat de modus echt', outsidePayload.datesAsRecorded === false);
const ifcOutsideMode = writeIFC(buildWriteIFCInput(outsidePayload));
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

// ── 3. Opslaan ÍN de modus: P6's waarden staan in `task.time` ────────────────────────────────
// `basePayload` (sectie 1) staat dankzij het T4-beleid AL in de modus — dat IS de "ín de modus
// opgeslagen"-toestand, geen aparte `applyRecordedTimesToTasks`-constructie meer nodig.
const ifcInMode = writeIFC(buildWriteIFCInput(basePayload));
const reopenedInMode = readXerArchiveIFC(ifcInMode);
eq('3a in de modus opgeslagen IFC levert dezelfde vastlegging', reopenedInMode.recordedTimes, originalTimes);
eq('3b in de modus opgeslagen IFC draagt de HEROPEN-herkomst', reopenedInMode.recordedTimesOrigin, 'xer-archive');
expect('3c de twee opslagvormen verschillen echt (anders bewijst 3a niets)',
  ifcInMode !== ifcOutsideMode);

// ── 4. Heropen-beleid: dezelfde vastlegging, maar NOOIT automatisch weer aan ──────────────────
// Orkestratorbesluit (2026-09-05): een heropende IFC met XER-archief krijgt NOOIT de automatische
// modus, ongeacht of het bestand ín of buiten de modus werd opgeslagen — alleen een VERSE
// XER-import (sectie 1) doet dat. Anders zou een sindsdien bewerkte en opgeslagen planning bij
// heropenen stilzwijgend P6's oude datums tonen.
store().newProject();
store().applyOpenedImport(reopenedOutside, {
  filePath: null, fileHandle: null, recompute: true, fit: false, hourDataNotice: false, linkedOpen: false,
});
const reopenedOutsidePayload = store().getOpenDocumentPayloads()[0]!.payload;
expect('4a heropenen van een buiten-de-modus opgeslagen IFC biedt de modus alleen aan',
  reopenedOutsidePayload.datesAsRecorded === false && reopenedOutsidePayload.recordedDates !== null);

store().newProject();
store().applyOpenedImport(reopenedInMode, {
  filePath: null, fileHandle: null, recompute: true, fit: false, hourDataNotice: false, linkedOpen: false,
});
const reopenedInModePayload = store().getOpenDocumentPayloads()[0]!.payload;
expect('4b heropenen van een ín-de-modus opgeslagen IFC biedt de modus OOK alleen aan (geen stille terugval naar aan)',
  reopenedInModePayload.datesAsRecorded === false && reopenedInModePayload.recordedDates !== null);
eq('4c beide heropeningen komen op hetzelfde aantal verschoven taken uit als de oorspronkelijke import',
  modeSummary(reopenedInModePayload).shifted, modeSummary(basePayload).shifted);
eq('4d ... en dat geldt ook voor de buiten-de-modus-heropening',
  modeSummary(reopenedOutsidePayload).shifted, modeSummary(basePayload).shifted);

// ── 5. IFC ZÓNDER XER-archief blijft byte-identiek gedrag houden ─────────────────────────────
const ifcWithoutArchive = writeIFC({
  ...buildWriteIFCInput(basePayload),
  xer: undefined, xerSourceArchive: undefined, xerSourceProjectId: undefined,
});
const reopenedPlain = readXerArchiveIFC(ifcWithoutArchive);
expect('5a IFC zonder XER-archief levert geen recordedTimes en geen herkomst',
  reopenedPlain.recordedTimes === undefined && reopenedPlain.recordedTimesOrigin === undefined);
expect('5b de bestaande #63-IFC-route (recordedFields) werkt daar onveranderd',
  captureRecordedDates(reopenedPlain.tasks, reopenedPlain.recordedFields).total === reopenedPlain.tasks.length);

// ── 6. Crashherstel is GEEN heropening: de modusvlag van vóór de crash komt terug ─────────────
// "Aan blijft aan, uit blijft uit" — en dat is sinds de critreview (bevindingen 2/3) een
// OPGESCHREVEN FEIT: `datesAsRecorded` reist als recovery-METADATA mee (manifestveld v4), net als
// `filePath`/`isDirty`. `restoreDocuments` leest die vlag en beslist niet opnieuw. De vorige,
// afgeleide vorm ("0 verschoven op de rauwe taken ⇒ de modus stond aan") was aantoonbaar
// vals-positief — zie 6h hieronder, precies de toestand waarin die heuristiek de modus ten
// onrechte weer aanzette.
async function recoverSingleDocument(label: string, payload: DocumentPayload): Promise<DocumentPayload> {
  await clearRecovery();
  const ifc = writeIFC(buildWriteIFCInput(payload));
  await saveRecovery(fullRecoverySave('doc-1', [{ id: 'doc-1', ifc, filePath: null, isDirty: true, datesAsRecorded: payload.datesAsRecorded }]));
  const loaded = await loadRecovery();
  expect(`${label}: recoveryStore levert de snapshot terug`, loaded.docs.length === 1);
  const recoveredParsed = readXerArchiveIFC(loaded.docs[0]!.ifc);
  const input = recoveryInputFromParsed(recoveredParsed, {
    id: 'doc-1', filePath: null, isDirty: true,
    // Wat de recovery-metadata teruggaf — de bewaarde modusvlag, geen aanname.
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
  recoveredFromInMode.recordedDates?.times, originalTimes);

const recoveredFromOutsideMode = await recoverSingleDocument('6d', outsidePayload);
expect('6e hersteld document dat vóór de crash UIT de modus stond, blijft UIT de modus (uit blijft uit)',
  recoveredFromOutsideMode.datesAsRecorded === false);
expect('6f ... maar het #63-aanbod verschijnt wel (de restverschillen blijven zichtbaar)',
  recoveredFromOutsideMode.recordedDates !== null);
eq('6g hersteld-buiten-modus document draagt dezelfde vastlegging als het gewone openen',
  recoveredFromOutsideMode.recordedDates?.times, originalTimes);

// 6h — HET GAT WAAR DE HEURISTIEK OP STUKLIEP (critreview bevinding 2). Een bewerking verlaat de
// modus en zet `scheduleStale`, maar de herberekening staat pas op `setTimeout(0)`
// (`useExitRecordedDates`); valt de auto-save-snapshot in dat gat, dan dráágt `task.time` nog
// steeds P6's waarden terwijl de modus UIT staat. De oude terugleesmeting zag dan "0 verschoven"
// en zette de modus weer aan — inclusief het wissen van de verouderd-vlag, op een half bewerkte
// planning. Met de metadatavlag kan dat niet meer.
{
  store().newProject();
  store().applyOpenedImport(original, {
    filePath: null, fileHandle: null, recompute: true, fit: false, hourDataNotice: false, linkedOpen: false,
  });
  expect('6h voorwaarde: de verse import opent ín de modus',
    store().getOpenDocumentPayloads()[0]!.payload.datesAsRecorded === true);
  const editId = store().tasks[0]!.id;
  const p6Start = store().tasks[0]!.time.earlyStart;
  store().updateTask(editId, { name: 'Hernoemd door gebruiker' });
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
  expect('6n ... en het #63-aanbod blijft over, zodat de gebruiker P6\'s datums zelf kan terugzetten',
    recoveredFromGap.recordedDates !== null);
}

// 6o — SLAPENDE documenten (critreview bevinding 3). `restoreDocuments` rekent alleen het actieve
// document door; de rest kwam terug met P6's datums in `task.time`, zonder modus en MET
// `scheduleStale` — waarna automatisch berekenen (of de eerste F5) die datums stil wegrekende.
{
  store().newProject();
  store().applyOpenedImport(original, {
    filePath: null, fileHandle: null, recompute: true, fit: false, hourDataNotice: false, linkedOpen: false,
  });
  const firstId = store().activeDocumentId!;
  store().newDocument();
  store().applyOpenedImport(original, {
    filePath: null, fileHandle: null, recompute: true, fit: false, hourDataNotice: false, linkedOpen: false,
  });
  const secondId = store().activeDocumentId!;
  const before = store().getOpenDocumentPayloads();
  expect('6o voorwaarde: beide documenten staan ín de modus',
    before.length === 2 && before.every(document => document.payload.datesAsRecorded === true));

  await clearRecovery();
  await saveRecovery(fullRecoverySave(secondId, before.map(document => ({
    id: document.id,
    ifc: writeIFC(buildWriteIFCInput(document.payload)),
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
  // Her-check laag 3, bevinding 4: "in de modus" betekent op het slapende pad hetzelfde als op het
  // actieve — de vastlegging staat er (zonder verzonnen `shifted`), dus export-poort, "niet
  // vastgelegd"-kolommen en badge werken. MUTATIEBEWIJS: laat `applyRestoredRecordedMode`
  // `payload.recordedDates` weer weg ⇒ 6v/6w slaan ROOD.
  expect('6v het SLAPENDE herstelde document draagt zijn vastlegging, zonder verzonnen teller',
    slapend?.recordedDates !== null && slapend?.recordedDates?.shifted === undefined
      && slapend?.recordedDates?.origin === 'xer-archive'
      && Object.keys(slapend?.recordedDates?.times ?? {}).length === Object.keys(originalTimes).length);
  expect('6w ... zodat de export-poort ook dáár actief is (geen verzonnen speling naar CSV/MCP)',
    slapend !== undefined && unrecordedExportGate(slapend.recordedDates, slapend.datesAsRecorded) !== undefined);
  // Alleen de taken die P6 écht vastlegde (R5 heeft geen vastlegging, zie sectie 2e): voor die
  // taken moet de weergave nog exact de vastlegging zijn, want er is niet herberekend.
  eq('6u ... en met P6\'s datums nog ín de vastgelegde taken',
    Object.fromEntries((slapend?.tasks ?? [])
      .filter(task => originalTimes[task.id] !== undefined)
      .map(task => [task.id, task.time.earlyStart])),
    Object.fromEntries(Object.entries(originalTimes).map(([id, time]) => [id, time.start])));

  // Deze sectie opende bewust een TWEEDE document; de secties hierna gaan van één uit.
  store().closeDocument(firstId);
  expect('6v opruimen: er blijft één document open voor de volgende secties',
    store().getOpenDocumentPayloads().length === 1);
}

// ── 7. MUTATIEBEWIJS — één orakelcel verschuift de vastlegging, niet de berekening ───────────
function chainOf(mutate: boolean): { times: Record<string, RecordedTime>; cpm: string } {
  const parsed = single(fixtureBytes(mutate));
  store().newProject();
  store().applyOpenedImport(parsed, {
    filePath: null, fileHandle: null, recompute: true, fit: false, hourDataNotice: false, linkedOpen: false,
  });
  const payload = store().getOpenDocumentPayloads()[0]!.payload;
  const reopened = readXerArchiveIFC(writeIFC(buildWriteIFCInput(payload)));
  store().newProject();
  store().applyOpenedImport(reopened, {
    filePath: null, fileHandle: null, recompute: true, fit: false, hourDataNotice: false, linkedOpen: false,
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

// ── 8. Hardening: de sha256-poort dekt ook de vastlegging ────────────────────────────────────
// Manipuleer één base64-teken van de eerste archiefchunk. De reconstructie mag dan NIET stil een
// andere vastlegging opleveren, maar moet de hele lezing weigeren.
const chunkMatch = /IFCPROPERTYSINGLEVALUE\('ByteChunk000000',\$,IFCTEXT\('([A-Za-z0-9+/=]+)'\)/.exec(ifcOutsideMode);
expect('8a de fixture-IFC draagt een leesbare archiefchunk', chunkMatch !== null);
if (chunkMatch) {
  const chunk = chunkMatch[1]!;
  const flipped = (chunk[0] === 'A' ? 'B' : 'A') + chunk.slice(1);
  const tampered = ifcOutsideMode.replace(`IFCTEXT('${chunk}')`, `IFCTEXT('${flipped}')`);
  let threw = false;
  try { readXerArchiveIFC(tampered); } catch { threw = true; }
  expect('8b een gemanipuleerde archiefchunk wordt geweigerd i.p.v. stil anders gelezen', threw);
}

// ── 9. Meerprojecten-XER: elk document krijgt de vastlegging van ZIJN EIGEN project ──────────
// Het archief is bestandsbreed en draagt de rijen van álle projecten. De selector `OPS_XerDocument`
// moet dus echt gebruikt worden — een implementatie die `results[0]` pakt, of die de projecten samen
// in één map gooit, valt hier om.
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
    filePath: null, fileHandle: null, recompute: true, fit: false, hourDataNotice: false, linkedOpen: false,
  });
  const docs = store().getOpenDocumentPayloads();
  eq('9b twee documenten geopend', docs.length, 2);
  for (const doc of docs) {
    const selector = doc.payload.xerSourceProjectId!;
    const before = twoProject.results.find(r => r.xer?.sourceProjectId === selector)!;
    const after = readXerArchiveIFC(writeIFC(buildWriteIFCInput(doc.payload)));
    eq(`9c ${selector} — heropend document krijgt de vastlegging van zijn EIGEN project`,
      after.recordedTimes, before.recordedTimes);
    eq(`9d ${selector} — en uitsluitend zijn eigen taak-id`,
      Object.keys(after.recordedTimes ?? {}), [selector === 'PA' ? 'A1' : 'B1']);
  }
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// MET CORPUS — dezelfde keten op twee echte P6-bestanden, mét tijdmeting.
// ═════════════════════════════════════════════════════════════════════════════════════════════
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
    filePath: null, fileHandle: null, recompute: true, fit: false, hourDataNotice: false, linkedOpen: false,
  });
  const payload = store().getOpenDocumentPayloads().find(d => d.payload.xerSourceProjectId === parsed.xer?.sourceProjectId)!.payload;
  const ifc = writeIFC(buildWriteIFCInput(payload));
  const tWrite = Date.now();
  const reopened = readXerArchiveIFC(ifc);
  const tReopen = Date.now();
  eq(`C-${label} vastlegging identiek na opslaan+heropenen`, reopened.recordedTimes, parsed.recordedTimes);
  // Heropen-beleid: de VERSE import draagt 'xer', maar elke HEROPENING (ook van hetzelfde
  // bestand) draagt altijd 'xer-archive' — dat is het hele punt van de policy, geen regressie.
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

// ── Uitslag ──────────────────────────────────────────────────────────────────────────────────
if (failures.length === 0) {
  console.log(`OK  xer-recorded-roundtrip: alle checks groen (${checks})`);
} else {
  console.log(`XX  xer-recorded-roundtrip: ${failures.length} afwijking(en) van ${checks}`);
  for (const failure of failures) console.log(`   XX ${failure}`);
  process.exit(1);
}
