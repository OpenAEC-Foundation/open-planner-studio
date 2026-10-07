// XER-bronarchief één keer schrijven in crashherstel (eigenaarsbesluit plan (9), 2026-09-22; herhaald
// bij de review van 2026-10-07). Corpusloos, met een synthetisch archief van ±16 MB uit één `.xer` met
// twee projecten (dus twee documenten die één archief delen).
//
// Wat deze batterij bewijst, langs de ECHTE productieroute (`runRecoveryTick` = wat `useAutoSave` per
// tick doet, `recoveryStore` web-backend tegen de gedeelde IndexedDB-dubbel, `readIFCWithXerReconstruction`
// met dezelfde resolver als `useRecoveryRestore`):
//   (a) budgetpoort: een bewerkingstick schrijft ≤ TICK_BUDGET_BYTES en geen archiefblob; ook de eerste
//       tick schrijft de snapshots zonder archief en precies één blob;
//   (b) herstel via de verwijzing geeft byte-identieke bronbytes;
//   (c) twee documenten uit één bestand delen één blob;
//   (d) ontbrekende blob ⇒ openen zonder archief, mét `xerArchiveIssue` `bytes-missing`;
//   (e) een oude snapshot met ingebed archief (manifest zonder verwijzing) herstelt nog;
//   (f) het echte opslaan schrijft het archief volledig, en een blob verdwijnt pas als niets er nog naar
//       verwijst.
// Mutant-bewijs: zet `serializeRecoverySnapshot` terug op de ingebedde vorm ⇒ (a) rood.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';
import { readFormatForFile, readIFCWithXerReconstruction } from '@/services/formatRegistry';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { isMultiDocumentImport } from '@/services/importTypes';
import { RecoveryDeltaTracker, type RecoverySourceDocument } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick, serializeRecoverySnapshot } from '@/services/recovery/recoverySnapshot';
import { clearRecovery, fullRecoverySave, loadRecovery, saveRecovery } from '@/services/recovery/recoveryStore';
import { readXER } from '@/services/xer/xerReader';
import {
  decodeXerSourceArchive, precomputeSha256, sha256Hex, sha256HexPortable, XER_SOURCE_ARCHIVE_CHUNK_BYTES,
} from '@/services/xerSourceArchive';
import { useAppStore } from '@/state/appStore';
import { recoveryInputFromParsed } from '@/state/documentContract';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';

declare const process: { exit(code: number): never };

/** Vaste, machine-onafhankelijke grens per bewerkingstick: één klein IFC-document plus manifest. */
const TICK_BUDGET_BYTES = 256 * 1024;

const failures: string[] = [];
let checks = 0;
const expect = (label: string, condition: boolean) => {
  checks += 1;
  if (!condition) failures.push(label);
};

// Bytes per put, per store. Strings tellen per teken, Uint8Array per byte.
const written = { records: 0, archives: 0, archivePuts: 0, read: 0 };
const sizeOf = (value: unknown): number => {
  if (typeof value === 'string') return value.length;
  if (value instanceof Uint8Array) return value.byteLength;
  if (Array.isArray(value)) return value.reduce((sum: number, item) => sum + sizeOf(item), 0);
  if (value && typeof value === 'object') return Object.values(value).reduce((sum: number, item) => sum + sizeOf(item), 0);
  return 0;
};
const idb = installFakeRecoveryIndexedDb({
  onPut: (store, value) => {
    if (store === 'xer-archives') { written.archives += sizeOf(value); written.archivePuts += 1; }
    else written.records += sizeOf(value);
  },
  onRead: (_store, _method, result) => { written.read += sizeOf(result); },
});
const resetWritten = () => { written.records = 0; written.archives = 0; written.archivePuts = 0; written.read = 0; };

// ── Synthetische bron: twee projecten, één groot onbekend tabelveld (±16 MB) ─────────────────────────
const PAYLOAD_CHUNKS = 82; // 82 × 196.608 B ≈ 16,1 MB
const bytes = new TextEncoder().encode([
  'ERMHDR\t23.12\t2026-08-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
  '%R\tP-A\tProject A\tC\t2026-08-01 08:00',
  '%R\tP-B\tProject B\tC\t2026-08-01 08:00',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC\tStandaard\t8\t40\t',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\ttask_code\ttask_name\tclndr_id\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\ttask_type\tduration_type\tstatus_code',
  '%R\tT-A\tP-A\tA-1\tTaak A\tC\t2026-08-03 08:00\t2026-08-03 16:00\t8\tTT_Task\tDT_FixedDUR2\tTK_NotStart',
  '%R\tT-B\tP-B\tB-1\tTaak B\tC\t2026-08-03 08:00\t2026-08-03 16:00\t8\tTT_Task\tDT_FixedDUR2\tTK_NotStart',
  '%T\tUNKNOWN',
  '%F\tpayload',
  `%R\t${'x'.repeat(PAYLOAD_CHUNKS * XER_SOURCE_ARCHIVE_CHUNK_BYTES)}`,
  '%E',
].join('\r\n'));
const sourceSha = sha256Hex(bytes);

const opened = readXER(bytes);
expect('0 de synthetische bron levert twee documenten met één archief',
  isMultiDocumentImport(opened) && opened.results.length === 2
  && opened.results.every((result) => result.xerSourceArchive?.sha256 === sourceSha));

const store = () => useAppStore.getState();
store().newProject();
store().applyOpenedImport(opened, {
  filePath: null, fileHandle: null, recompute: false, fit: false, hourDataNotice: false, linkedOpen: false,
});

const tracker = new RecoveryDeltaTracker();
const recoveryDocs = (): RecoverySourceDocument[] => store().getOpenDocumentPayloads().map(({ id, payload }) => ({
  id, source: payload, filePath: payload.filePath, isDirty: payload.isDirty, datesAsRecorded: payload.datesAsRecorded,
}));
const tick = async () => {
  resetWritten();
  const started = performance.now();
  await runRecoveryTick(tracker, store().activeDocumentId, recoveryDocs());
  return { ms: performance.now() - started, records: written.records, archives: written.archives, archivePuts: written.archivePuts, read: written.read };
};

// ── (a)/(c) eerste tick: snapshots zonder archief, precies één gedeelde blob ──────────────────────────
const docsAtStart = store().getOpenDocumentPayloads();
expect('0a beide documenten dragen het archief in het documentcontract',
  docsAtStart.length === 2 && docsAtStart.every((doc) => doc.payload.xerSourceArchive?.sha256 === sourceSha));
const first = await tick();
expect(`a1 eerste tick: de snapshots zelf blijven onder ${TICK_BUDGET_BYTES} B (gemeten ${first.records})`,
  first.records <= TICK_BUDGET_BYTES);
// De blob telt de bronbytes plus zijn sleutel (64 tekens); meer dan een paar honderd bytes extra
// zou een tweede kopie of een codering (base64 = +33 %) betekenen.
expect(`a2 eerste tick: precies één archiefblob met de ruwe bronbytes (gemeten ${first.archivePuts} blob(s), ${first.archives} B)`,
  first.archivePuts === 1 && first.archives >= bytes.length && first.archives <= bytes.length + 256);
expect('c1 twee documenten uit één bestand delen één blob in de opslag',
  idb.store('xer-archives').size === 1 && idb.store('xer-archives').has(sourceSha));

// Bewerkingstick: één document wijzigt. Het archief mag NIET opnieuw geserialiseerd of geschreven worden.
store().setProject({ description: 'bewerking-na-de-eerste-tick' });
const edit = await tick();
expect(`a3 bewerkingstick schrijft ≤ ${TICK_BUDGET_BYTES} B (gemeten ${edit.records} B snapshots + ${edit.archives} B archief)`,
  edit.records + edit.archives <= TICK_BUDGET_BYTES);
expect('a4 bewerkingstick schrijft geen archiefblob opnieuw', edit.archivePuts === 0);
// Prestatiemeting 2026-10-07: `saveWeb` las per tick alle snapshots terug (`getAll`). Nu alleen sleutels
// en manifesten: de gelezen bytes blijven ver onder één snapshot.
expect(`a6 bewerkingstick leest alleen sleutels en manifesten terug (gemeten ${edit.read} B gelezen)`,
  edit.read <= 4 * 1024);
const snapshot = serializeRecoverySnapshot(store().getOpenDocumentPayloads()[0]!.payload);
expect(`a5 de snapshottekst zelf draagt het archief niet (${snapshot.length} tekens)`,
  snapshot.length <= TICK_BUDGET_BYTES && !snapshot.includes('ByteChunk000000'));
console.log(`X9 recovery-once: bron=${bytes.length} B | tick1 snapshots=${first.records} B archief=${first.archives} B ${first.ms.toFixed(0)} ms | bewerkingstick snapshots=${edit.records} B archief=${edit.archives} B gelezen=${edit.read} B ${edit.ms.toFixed(1)} ms`);

// ── (b)/(c) herstel via de verwijzing ───────────────────────────────────────────────────────────
const restoreFrom = async () => {
  const loaded = await loadRecovery();
  const parsed = [];
  for (const doc of loaded.docs) {
    parsed.push(await readIFCWithXerReconstruction(doc.ifc, {}, {
      resolveXerArchiveReference: (sha256) => loaded.archives.get(sha256),
    }));
  }
  return { loaded, parsed };
};
const restored = await restoreFrom();
expect('b1 het manifest verwijst voor beide documenten naar dezelfde blob',
  restored.loaded.docs.length === 2 && restored.loaded.docs.every((doc) => doc.xerArchive === sourceSha)
  && restored.loaded.archives.size === 1);
expect('b2 herstel via de verwijzing geeft byte-identieke bronbytes voor elk document',
  restored.parsed.every((result) => result.xerSourceArchive !== undefined && result.xerArchiveIssue === undefined
    && sha256Hex(decodeXerSourceArchive(result.xerSourceArchive)) === sourceSha
    && decodeXerSourceArchive(result.xerSourceArchive).every((byte, index) => byte === bytes[index])));
expect('b3 de herstelde selector en XER-metadata zijn er weer',
  restored.parsed.map((result) => result.xer?.sourceProjectId).sort().join(',') === 'P-A,P-B');
expect('b4 de bewerking uit de tweede tick is hersteld',
  restored.parsed.some((result) => result.project.description === 'bewerking-na-de-eerste-tick'));
const inputs = restored.loaded.docs.map((doc, index) => recoveryInputFromParsed(restored.parsed[index]!, {
  id: doc.id, filePath: doc.filePath, isDirty: doc.isDirty, datesAsRecorded: doc.datesAsRecorded,
}));
const restoreResult = store().restoreDocuments(inputs, restored.loaded.activeDocumentId);
expect('b5 de store herstelt beide documenten mét archief',
  restoreResult.skippedIds.length === 0
  && store().getOpenDocumentPayloads().every((doc) => doc.payload.xerSourceArchive?.sha256 === sourceSha));

// ── (f) het echte opslaan blijft het archief volledig schrijven (het IFC is de bron) ─────────────
const savedIfc = writeIFC(buildWriteIFCInput(store().getOpenDocumentPayloads()[0]!.payload));
const reopened = await readFormatForFile('project.ifc').read({ name: 'project.ifc', text: savedIfc }, {});
const reopenedResult = Array.isArray((reopened as { results?: unknown }).results) ? null : reopened;
expect('f1 opslaan als IFC draagt de volledige bronbytes (ingebed, schema 2)',
  savedIfc.includes('ByteChunk000000') && savedIfc.length > bytes.length);
expect('f2 heropenen van het opgeslagen IFC geeft byte-identieke bronbytes, zonder crashherstelopslag',
  reopenedResult !== null && 'xerSourceArchive' in reopenedResult && reopenedResult.xerSourceArchive !== undefined
  && sha256Hex(decodeXerSourceArchive(reopenedResult.xerSourceArchive)) === sourceSha);

// ── (d) ontbrekende blob ⇒ openen met melding ─────────────────────────────────────────────────
idb.store('xer-archives').delete(sourceSha);
const missing = await restoreFrom();
expect('d1 zonder blob levert loadRecovery geen archiefbytes', missing.loaded.archives.size === 0);
expect('d2 zonder blob opent elk document zonder archief en mét bytes-missing',
  missing.parsed.length === 2 && missing.parsed.every((result) =>
    result.xerSourceArchive === undefined && result.xerSourceProjectId === undefined
    && result.xerArchiveIssue?.code === 'bytes-missing'));
expect('d3 het project zelf opent gewoon (taken aanwezig)', missing.parsed.every((result) => result.tasks.length > 0));
const missingInputs = missing.loaded.docs.map((doc, index) => recoveryInputFromParsed(missing.parsed[index]!, {
  id: doc.id, filePath: doc.filePath, isDirty: doc.isDirty, datesAsRecorded: doc.datesAsRecorded,
}));
expect('d4 het signaal reist mee in de herstelinvoer (bron van de in-app melding)',
  missingInputs.every((input) => input.xerArchiveIssue?.code === 'bytes-missing'));
const noResolver = await readIFCWithXerReconstruction(snapshot);
expect('d5 een referentiesnapshot buiten crashherstel (zonder resolver) geeft ook bytes-missing',
  noResolver.xerSourceArchive === undefined && noResolver.xerArchiveIssue?.code === 'bytes-missing');

// ── (e) oude snapshotvorm: ingebed archief, manifest zonder verwijzing ─────────────────────────
await clearRecovery();
const legacyDoc = store().getOpenDocumentPayloads()[0]!;
await saveRecovery(fullRecoverySave(legacyDoc.id, [{
  id: legacyDoc.id, ifc: writeIFC(buildWriteIFCInput(legacyDoc.payload)),
  filePath: null, isDirty: true, datesAsRecorded: false,
}]));
const legacy = await restoreFrom();
expect('e1 een oude snapshot zonder verwijzing schrijft en verwacht geen blob',
  legacy.loaded.docs.length === 1 && legacy.loaded.docs[0]!.xerArchive === undefined
  && idb.store('xer-archives').size === 0);
expect('e2 een oude snapshot met ingebed archief herstelt byte-identiek',
  legacy.parsed[0]?.xerSourceArchive !== undefined
  && sha256Hex(decodeXerSourceArchive(legacy.parsed[0].xerSourceArchive)) === sourceSha);

// ── (f) opruimen: de blob blijft zolang één snapshot ernaar verwijst ───────────────────────────
await clearRecovery();
const cleanupTracker = new RecoveryDeltaTracker();
const all = recoveryDocs();
await runRecoveryTick(cleanupTracker, all[0]!.id, all);
expect('f3 na een verse ronde staat er weer precies één blob', idb.store('xer-archives').size === 1);
await runRecoveryTick(cleanupTracker, all[1]!.id, [all[1]!]);
expect('f4 één van twee documenten dicht: de blob blijft (het andere verwijst er nog naar)',
  idb.store('xer-archives').size === 1);
const plainDoc = { ...all[1]!, source: { ...all[1]!.source, xerSourceArchive: null, xerSourceProjectId: null, xerImportMetadata: null } };
await runRecoveryTick(cleanupTracker, plainDoc.id, [plainDoc]);
expect('f5 geen enkele snapshot verwijst nog: de blob is opgeruimd', idb.store('xer-archives').size === 0);
await clearRecovery();
expect('f6 clearRecovery laat geen records of blobs achter',
  idb.store('records').size === 0 && idb.store('xer-archives').size === 0);

// ── (g) native SHA-256 (`crypto.subtle`) = de draagbare JS-versie: de content-adressering blijft gelijk ──
{
  const samples = [new Uint8Array(0), new TextEncoder().encode('abc'), bytes.subarray(5, 70_000), bytes];
  let same = true;
  for (const sample of samples) {
    const copy = sample.slice();
    same &&= (await precomputeSha256(copy)) === sha256HexPortable(sample) && sha256Hex(copy) === sha256HexPortable(sample);
  }
  expect('g1 precomputeSha256 (native) geeft dezelfde hex als de draagbare implementatie, ook voor een subarray', same);
  expect('g2 de bekende sha van de bron is de SHA-256 van de bytes', sha256HexPortable(bytes) === sourceSha);
}

if (failures.length > 0) {
  console.log(`XX  xer-archive-recovery-once: ${failures.length} afwijking(en) van ${checks}`);
  for (const failure of failures) console.log(`   - ${failure}`);
  process.exit(1);
}
console.log(`OK  xer-archive-recovery-once: alle ${checks} checks groen`);
