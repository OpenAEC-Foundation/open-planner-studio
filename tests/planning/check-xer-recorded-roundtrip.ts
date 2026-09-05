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
 *  3. `recordedTimesOrigin` — de vlag die het standaard-aan-beleid van taak T4 stuurt — reist mee,
 *     dus een heropend XER-document neemt dezelfde beslissing als het origineel.
 *  4. Een IFC ZONDER XER-archief blijft byte-identiek: geen `recordedTimes`, geen origin, en de
 *     bestaande #63-IFC-route (`recordedFields`) doet onveranderd zijn werk.
 *  5. Het crashherstelpad (`recoveryStore` → `readIFCWithXerReconstruction` → `restoreDocuments`)
 *     levert dezelfde vastlegging als het gewone openen.
 *  6. MUTATIEBEWIJS: één gewijzigde orakelcel in de bron verplaatst de vastlegging over de hele
 *     keten heen WÉL, maar het `cpmResult` ná `runCPM` GEEN millimeter.
 *  7. Hardening: de sha256-poort op het archief geldt ook voor de vastlegging — een gemanipuleerde
 *     archiefchunk wordt geweigerd in plaats van stil een andere vastlegging op te leveren.
 *
 * WAT DIT BEWUST NIET DOET: de store-vlag `datesAsRecorded` zelf wordt door taak T4
 * (`fileSlice.applyLoadedProject`) gezet en is op deze basis nog niet bedraad. Deze check toetst de
 * volledige INVOER van dat besluit (`recordedTimes` + `recordedTimesOrigin` + de shifted-telling) en
 * spiegelt de T4-beslisregel in `modeVerdict()` hieronder, zodat de gelijkheid vóór/ná de
 * round-trip nu al vastligt.
 */
import { captureRecordedDates, countShiftedTasks, applyRecordedTimesToTasks } from '@/engine/scheduler/recordedDates';
import type { RecordedTime } from '@/engine/scheduler/recordedDates';
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

/** De T4-beslisregel, hier gespiegeld: alleen de bron-orakelroute opent meteen ín de modus, en
 *  alleen wanneer de herberekening daadwerkelijk iets verschoof. */
function modeVerdict(parsed: ImportResult, solvedTasks: ImportResult['tasks']): { origin: string | undefined; total: number; shifted: number; mode: boolean } {
  const recorded = captureRecordedDates(parsed.tasks, parsed.recordedFields, parsed.recordedTimes);
  const shifted = countShiftedTasks(solvedTasks, recorded.times);
  return {
    origin: parsed.recordedTimesOrigin,
    total: recorded.total,
    shifted,
    mode: parsed.recordedTimesOrigin === 'xer' && recorded.total > 0 && shifted > 0,
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

// ── 2. Opslaan BUITEN de modus: `task.time` draagt onze herberekening ────────────────────────
const ifcOutsideMode = writeIFC(buildWriteIFCInput(basePayload));
const reopenedOutside = readXerArchiveIFC(ifcOutsideMode);
eq('2a heropend IFC levert exact dezelfde vastlegging (alle zes assen, incl. de undefined-assen)',
  reopenedOutside.recordedTimes, originalTimes);
eq('2b heropend IFC draagt dezelfde herkomst', reopenedOutside.recordedTimesOrigin, 'xer');
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
const inModePayload = {
  ...basePayload,
  tasks: basePayload.tasks.map(t => ({ ...t, time: { ...t.time } })),
};
applyRecordedTimesToTasks(inModePayload.tasks, originalTimes, inModePayload.calendar);
const ifcInMode = writeIFC(buildWriteIFCInput(inModePayload));
const reopenedInMode = readXerArchiveIFC(ifcInMode);
eq('3a in de modus opgeslagen IFC levert dezelfde vastlegging', reopenedInMode.recordedTimes, originalTimes);
eq('3b in de modus opgeslagen IFC draagt dezelfde herkomst', reopenedInMode.recordedTimesOrigin, 'xer');
expect('3c de twee opslagvormen verschillen echt (anders bewijst 3a niets)',
  ifcInMode !== ifcOutsideMode);

// ── 4. Het modusbesluit is identiek vóór en ná de round-trip ─────────────────────────────────
const verdictBefore = modeVerdict(original, basePayload.tasks);
store().newProject();
store().applyOpenedImport(reopenedOutside, {
  filePath: null, fileHandle: null, recompute: true, fit: false, hourDataNotice: false, linkedOpen: false,
});
const reopenedPayload = store().getOpenDocumentPayloads()[0]!.payload;
const verdictAfter = modeVerdict(reopenedOutside, reopenedPayload.tasks);
eq('4a hetzelfde standaard-aan-besluit (origin/total/shifted/mode) vóór en ná opslaan+heropenen',
  verdictAfter, verdictBefore);
expect('4b het besluit is niet triviaal: deze fixture verschuift echt taken', verdictBefore.mode);

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

// ── 6. Crashherstel: recoveryStore-round-trip ────────────────────────────────────────────────
await clearRecovery();
store().newProject();
store().applyOpenedImport(original, {
  filePath: null, fileHandle: null, recompute: true, fit: false, hourDataNotice: false, linkedOpen: false,
});
const recoverySource = store().getOpenDocumentPayloads();
await saveRecovery(fullRecoverySave(recoverySource[0]!.id, recoverySource.map(document => ({
  id: document.id,
  ifc: writeIFC(buildWriteIFCInput(document.payload)),
  filePath: null,
  isDirty: true,
}))));
const loaded = await loadRecovery();
expect('6a recoveryStore levert de snapshot terug', loaded.docs.length === recoverySource.length);
const recoveredParsed = loaded.docs.map(d => readXerArchiveIFC(d.ifc));
eq('6b hersteld document draagt dezelfde vastlegging als het gewone openen',
  recoveredParsed[0]?.recordedTimes, originalTimes);
eq('6c hersteld document draagt dezelfde herkomst', recoveredParsed[0]?.recordedTimesOrigin, 'xer');
const recoveryInputs = loaded.docs.map((d, i) => recoveryInputFromParsed(
  recoveredParsed[i]!, { id: d.id, filePath: null, isDirty: true },
));
store().restoreDocuments(recoveryInputs, recoveryInputs[0]!.id);
const restored = store().getOpenDocumentPayloads()[0]!.payload;
eq('6d na restoreDocuments is het modusbesluit gelijk aan dat van het gewone openen',
  modeVerdict(recoveryInputs[0]!, restored.tasks), verdictBefore);
await clearRecovery();

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
  eq(`C-${label} herkomst identiek na opslaan+heropenen`, reopened.recordedTimesOrigin, parsed.recordedTimesOrigin);
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
