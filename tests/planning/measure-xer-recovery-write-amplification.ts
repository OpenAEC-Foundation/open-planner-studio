/**
 * Snelle, corpusloze opslaggrensmeting voor het gelande delta-recoverypakket. Deze check draait
 * expliciet via `tests/planning/run.sh`; de echte OZB/rehab-proef staat daarnaast in
 * `check-xer-archive-recovery-corpus.ts`.
 *
 * Contractknip:
 *   1. `src/hooks/useAutoSave.ts` vergelijkt `IFCSaveSource` met `sameIFCSource` (isDirty is geen
 *      revisie-id) en biedt alle manifestmetadata plus uitsluitend nieuwe/gewijzigde IFC-upserts aan;
 *   2. Tauri schrijft een v3-manifest naar immutable generatie-snapshots, rename't het manifest als
 *      commitpoint en ruimt alleen ná die commit op; v1/v2 blijven leesbaar;
 *   3. IndexedDB doet upserts, manifest en deletes in één strikte readwrite-transactie, zonder de
 *      losse `idbPut`-helpers; een schrijffout promoot de persisted baseline nooit.
 *
 * De grens is structureel: één gewijzigde documentinhoud = één doc-upsert plus één manifest-put
 * in één transactie. Walltime en RSS horen hier bewust niet thuis; die worden in verse processen
 * gemeten en informatief gelogd door de corpuscheck.
 */
import { clearRecovery, loadRecovery, saveRecovery } from '@/services/recovery/recoveryStore';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';

declare const process: { exit(code: number): never };

interface StoredRecord { id: string; kind: 'doc' | 'manifest'; ifc?: string; }

let documentWrites = 0;
let unchangedDocumentWrites = 0;
let manifestWrites = 0;
let readwriteTransactions = 0;
installFakeRecoveryIndexedDb({
  onTransaction: (mode) => { if (mode === 'readwrite') readwriteTransactions += 1; },
  onPut: (_store, value, previous) => {
    const record = value as StoredRecord;
    const before = previous as StoredRecord | undefined;
    if (record.kind === 'doc') documentWrites += 1;
    if (record.kind === 'manifest') manifestWrites += 1;
    if (record.kind === 'doc' && before?.kind === 'doc' && before.ifc === record.ifc) unchangedDocumentWrites += 1;
  },
});

const docs = Array.from({ length: 12 }, (_, index) => ({
  id: `doc-${String(index + 1).padStart(2, '0')}`,
  ifc: `IFC-${index + 1}-ongewijzigd`,
  filePath: null,
  isDirty: true,
  datesAsRecorded: false,
}));

await clearRecovery();
await saveRecovery({
  activeDocumentId: docs[0]!.id,
  documents: docs.map(({ id, filePath, isDirty }) => ({ id, filePath, isDirty, datesAsRecorded: false })),
  upserts: docs,
});
documentWrites = 0;
unchangedDocumentWrites = 0;
manifestWrites = 0;
readwriteTransactions = 0;
const changed = docs.map((doc, index) => index === 0 ? { ...doc, ifc: 'IFC-1-gemuteerd' } : doc);
await saveRecovery({
  activeDocumentId: changed[0]!.id,
  documents: changed.map(({ id, filePath, isDirty }) => ({ id, filePath, isDirty, datesAsRecorded: false })),
  upserts: [changed[0]!],
});
const changedWrites = documentWrites;
const changedManifestWrites = manifestWrites;
const changedTransactions = readwriteTransactions;
const changedRecovery = await loadRecovery();
documentWrites = 0;
unchangedDocumentWrites = 0;
manifestWrites = 0;
readwriteTransactions = 0;
await saveRecovery({
  activeDocumentId: changed[1]!.id,
  documents: changed.map(({ id, filePath, isDirty }) => ({ id, filePath, isDirty, datesAsRecorded: false })),
  upserts: [],
});
const metadataOnlyWrites = documentWrites;
const metadataOnlyManifestWrites = manifestWrites;
const metadataOnlyTransactions = readwriteTransactions;
const metadataRecovery = await loadRecovery();
await clearRecovery();

if (
  changedWrites === 1
  && unchangedDocumentWrites === 0
  && changedManifestWrites === 1
  && changedTransactions === 1
  && changedRecovery.docs.length === 12
  && changedRecovery.docs[0]?.ifc === 'IFC-1-gemuteerd'
  && metadataOnlyWrites === 0
  && metadataOnlyManifestWrites === 1
  && metadataOnlyTransactions === 1
  && metadataRecovery.activeDocumentId === changed[1]!.id
) {
  console.log('OK  X9 delta-recovery: één mutatie schrijft één IFC-record; actieve-tabwissel is manifest-only');
  process.exit(0);
}
console.log(
  `RED X9 delta-recovery: changed-doc-writes=${changedWrites}; unchanged=${unchangedDocumentWrites}; ` +
  `changed-manifest=${changedManifestWrites}; changed-transactions=${changedTransactions}; ` +
  `metadata-doc-writes=${metadataOnlyWrites}; metadata-manifest=${metadataOnlyManifestWrites}; ` +
  `metadata-transactions=${metadataOnlyTransactions}.`,
);
console.log('    Knip: manifestmetadata + delta-upserts → één strikte IndexedDB-transactie → herstelcontract.');
process.exit(1);
