/**
 * Bewust RODE meetfixture voor het losstaande delta-recoverypakket.
 *
 * Niet als `check-*.ts` benoemd en daarom niet aan `tests/planning/run.sh` toegevoegd: de huidige
 * recoverycontracten accepteren volledige `RecoveryDocContent[]` en schrijven iedere aangeleverde
 * IFC opnieuw. Deze fixture moet pas groen worden wanneer dat pakket als één geheel verandert.
 *
 * Implementatieknip:
 *   1. `src/hooks/useAutoSave.ts` vergelijkt `IFCSaveSource` met `sameIFCSource` (isDirty is geen
 *      revisie-id) en biedt alle manifestmetadata plus uitsluitend nieuwe/gewijzigde IFC-upserts aan;
 *   2. Tauri schrijft een v3-manifest naar immutable generatie-snapshots, rename't het manifest als
 *      commitpoint en ruimt alleen ná die commit op; v1/v2 blijven leesbaar;
 *   3. IndexedDB doet upserts, manifest en deletes in één strikte readwrite-transactie, zonder de
 *      losse `idbPut`-helpers; een schrijffout promoot de persisted baseline nooit.
 */
import { clearRecovery, loadRecovery, saveRecovery } from '@/services/recovery/recoveryStore';

declare const process: { exit(code: number): never };

interface StoredRecord { id: string; kind: 'doc' | 'manifest'; ifc?: string; }

const records = new Map<string, StoredRecord>();
let documentWrites = 0;
let unchangedDocumentWrites = 0;
let manifestWrites = 0;
let readwriteTransactions = 0;
const fakeDb = {
  objectStoreNames: { contains: () => true },
  createObjectStore: () => undefined,
  close: () => undefined,
  onversionchange: null as (() => void) | null,
  transaction: (_store: string, mode: string) => {
    if (mode === 'readwrite') readwriteTransactions += 1;
    const tx = {
      oncomplete: null as (() => void) | null,
      onerror: null as (() => void) | null,
      error: null,
      objectStore: () => ({
        getAll: () => {
          const request = { result: [] as StoredRecord[], error: null, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
          queueMicrotask(() => { request.result = [...records.values()]; request.onsuccess?.(); });
          return request;
        },
        put: (value: StoredRecord) => {
          const previous = records.get(value.id);
          if (value.kind === 'doc') documentWrites += 1;
          if (value.kind === 'manifest') manifestWrites += 1;
          if (value.kind === 'doc' && previous?.kind === 'doc' && previous.ifc === value.ifc) {
            unchangedDocumentWrites += 1;
          }
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

const docs = Array.from({ length: 12 }, (_, index) => ({
  id: `doc-${String(index + 1).padStart(2, '0')}`,
  ifc: `IFC-${index + 1}-ongewijzigd`,
  filePath: null,
  isDirty: true,
}));

await clearRecovery();
await saveRecovery({
  activeDocumentId: docs[0]!.id,
  documents: docs.map(({ id, filePath, isDirty }) => ({ id, filePath, isDirty })),
  upserts: docs,
});
documentWrites = 0;
unchangedDocumentWrites = 0;
manifestWrites = 0;
readwriteTransactions = 0;
const changed = docs.map((doc, index) => index === 0 ? { ...doc, ifc: 'IFC-1-gemuteerd' } : doc);
await saveRecovery({
  activeDocumentId: changed[0]!.id,
  documents: changed.map(({ id, filePath, isDirty }) => ({ id, filePath, isDirty })),
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
  documents: changed.map(({ id, filePath, isDirty }) => ({ id, filePath, isDirty })),
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
