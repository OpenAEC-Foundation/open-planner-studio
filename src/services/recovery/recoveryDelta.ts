import type { RecoverySourceCopy } from './recoverySourceCopies';
import { ifcSourceMetaFields, sameRecoveryIfcSource, type RecoveryIfcSource } from './recoveryIfcSource';
import { ifcxMetaFields, sameRecoveryIfcx } from './recoveryIfcx';
import { IfcCalendarTimePrecisionError } from '@/services/ifc/ifcErrors';
import { sameIFCSource, type IFCSaveSource } from '@/state/ifcSaveInput';
import { foreignSourceTargetOf } from '@/services/ifc/foreign/foreignSourceMark';
import {
  foreignSourceMetaFields, sameRecoveryForeignSource, sameRecoverySiteMeta, siteMetaFields,
  type RecoveryArchiveSupplier, type RecoveryDocContent, type RecoveryDocMetadata, type RecoverySaveInput,
} from './recoveryStore';
import { decodeXerSourceArchive } from '@/services/xerSourceArchive';
import type { RecoverySnapshot } from './recoverySnapshotInput';
import { hasSharedGlobalIds, type RecoverySnapshotIdentities } from './recoveryIdentity';

export interface RecoverySourceDocument extends RecoveryDocMetadata {
  source: IFCSaveSource;
  sourceCopy?: RecoverySourceCopy;
}

export interface PersistedRecoveryState {
  activeDocumentId: string | null;
  documents: RecoveryDocMetadata[];
  sources: ReadonlyMap<string, IFCSaveSource>;
  copyVersions?: ReadonlyMap<string, string | null>;
}

export interface RecoveryDelta {
  changedDocuments: RecoverySourceDocument[];
  manifestChanged: boolean;
  needsPersist: boolean;
}

function metadataOf(document: RecoverySourceDocument): RecoveryDocMetadata {
  const { id, filePath, isDirty, datesAsRecorded } = document;
  const sha = document.source.xerSourceArchive?.sha256;
  return {
    id, filePath, isDirty, datesAsRecorded,
    ...(sha ? { xerArchive: sha } : {}),
    ...siteMetaFields(document),
    ...foreignSourceMetaFields({ foreignSource: document.foreignSource !== undefined ? document.foreignSource : foreignSourceTargetOf(document.source.foreignSourceMark) }),
    ...ifcSourceMetaFields(document),
    ...ifcxMetaFields(document),
  };
}

function archiveSuppliers(documents: readonly RecoverySourceDocument[]): Map<string, RecoveryArchiveSupplier> {
  const out = new Map<string, RecoveryArchiveSupplier>();
  for (const document of documents) {
    const archive = document.source.xerSourceArchive;
    if (archive?.sha256 && !out.has(archive.sha256)) out.set(archive.sha256, () => decodeXerSourceArchive(archive));
  }
  return out;
}

function sameMetadata(a: readonly RecoveryDocMetadata[], b: readonly RecoveryDocMetadata[]): boolean {
  return a.length === b.length && a.every((value, index) => {
    const other = b[index];
    return other !== undefined
      && value.id === other.id
      && value.filePath === other.filePath
      && value.isDirty === other.isDirty
      && value.datesAsRecorded === other.datesAsRecorded
      && (value.xerArchive ?? null) === (other.xerArchive ?? null)
      && sameRecoverySiteMeta(value, other)
      && sameRecoveryForeignSource(value, other)
      && sameRecoveryIfcSource(value, other)
      && sameRecoveryIfcx(value, other);
  });
}

export function planRecoveryDelta(
  activeDocumentId: string | null,
  documents: readonly RecoverySourceDocument[],
  persisted: PersistedRecoveryState | null,
): RecoveryDelta {
  const metadata = documents.map(metadataOf);
  const changedDocuments = documents.filter((document) => {
    const previous = persisted?.sources.get(document.id);
    return previous === undefined || !sameIFCSource(previous, document.source);
  });
  const manifestChanged = persisted === null
    || persisted.activeDocumentId !== activeDocumentId
    || !sameMetadata(persisted.documents, metadata)
    || documents.some(d => d.sourceCopy && d.sourceCopy.siteFileVersion !== persisted.copyVersions?.get(d.id));
  return {
    changedDocuments,
    manifestChanged,
    needsPersist: manifestChanged || changedDocuments.length > 0,
  };
}

export function persistedRecoveryState(
  activeDocumentId: string | null,
  documents: readonly RecoverySourceDocument[],
): PersistedRecoveryState {
  return {
    activeDocumentId,
    documents: documents.map(metadataOf),
    sources: new Map(documents.map((document) => [document.id, comparisonSource(document.source)])),
    copyVersions: new Map(documents.flatMap(d => d.sourceCopy ? [[d.id, d.sourceCopy.siteFileVersion] as const] : [])),
  };
}

interface SnapshotIdentities {
  readonly tracked: boolean;
  readonly identities?: RecoverySnapshotIdentities;
}

function snapshotOf(output: string | RecoverySnapshot, tracked: boolean): { ifc: string } & SnapshotIdentities {
  if (typeof output === 'string') return { ifc: output, tracked };
  return { ifc: output.ifc, tracked, ...(output.identities ? { identities: output.identities } : {}) };
}

const identitiesOf = ({ tracked, identities }: SnapshotIdentities): SnapshotIdentities =>
  identities ? { tracked, identities } : { tracked };

const tracksIdentities = (doc: RecoverySourceDocument) => doc.ifcSource !== undefined || !!doc.ifcx?.references;

function comparisonSource(source: IFCSaveSource): IFCSaveSource {
  return source.ifcSource ? { ...source, ifcSource: null } : source;
}

export class RecoveryDeltaTracker {
  private persisted: PersistedRecoveryState | null = null;
  private readonly serialized = new Map<string, { source: IFCSaveSource; ifc: string } & SnapshotIdentities>();
  private committed = new Map<string, SnapshotIdentities>();
  private upserted = new Map<string, SnapshotIdentities>();
  private readonly skipped = new Set<string>();
  private tail: Promise<unknown> = Promise.resolve();

  runExclusive<T>(action: () => Promise<T>): Promise<T> {
    const run = this.tail.then(action, action);
    this.tail = run.catch(() => undefined);
    return run;
  }

  async prepareAsync(
    activeDocumentId: string | null,
    documents: readonly RecoverySourceDocument[],
    serialize: (source: IFCSaveSource, identities: boolean) => Promise<string | RecoverySnapshot>,
  ): Promise<RecoverySaveInput | null> {
    const delta = this.delta(activeDocumentId, documents);
    if (!delta.needsPersist) return null;
    this.skipped.clear();
    for (const document of delta.changedDocuments) {
      if (!this.cachedSnapshot(document)) {
        const tracked = tracksIdentities(document);
        try {
          const snapshot = snapshotOf(await serialize(document.source, tracked), tracked);
          this.serialized.set(document.id, { source: comparisonSource(document.source), ...snapshot });
        } catch (error) {
          if (!(error instanceof IfcCalendarTimePrecisionError)) throw error;
          this.skipped.add(document.id);
          console.warn('Crashherstel slaat een document met een niet-schrijfbare kalender over; de vorige snapshot blijft staan.', document.id, error);
        }
      }
    }
    const retained = this.recoverableDocuments(documents);
    return this.prepare(this.recoverableActiveId(activeDocumentId, retained), retained, () => { throw new Error('Crashherstel-cache ontbreekt.'); });
  }

  private recoverableDocuments(documents: readonly RecoverySourceDocument[]): RecoverySourceDocument[] {
    return documents.flatMap(document => {
      if (!this.skipped.has(document.id)) return [document];
      const previous = this.persisted?.documents.find(d => d.id === document.id);
      const source = this.persisted?.sources.get(document.id);
      return previous && source ? [{ ...previous, source }] : [];
    });
  }

  private delta(activeDocumentId: string | null, documents: readonly RecoverySourceDocument[]): RecoveryDelta {
    const delta = planRecoveryDelta(activeDocumentId, documents, this.persisted);
    const changed = new Set(delta.changedDocuments);
    const untracked = documents.filter(d => !changed.has(d) && d.ifcSource !== undefined && this.committed.get(d.id)?.tracked === false
      && hasSharedGlobalIds(d.source.ifcGlobalIds));
    if (untracked.length === 0) return delta;
    for (const document of untracked) changed.add(document);
    return { changedDocuments: documents.filter(d => changed.has(d)), manifestChanged: delta.manifestChanged, needsPersist: true };
  }

  private cachedSnapshot(document: RecoverySourceDocument): ({ ifc: string } & SnapshotIdentities) | undefined {
    const cached = this.serialized.get(document.id);
    if (!cached || !sameIFCSource(cached.source, document.source) || (tracksIdentities(document) && !cached.tracked)) return undefined;
    return { ifc: cached.ifc, ...identitiesOf(cached) };
  }

  private manifestDocument(document: RecoverySourceDocument): RecoveryDocMetadata {
    const identities = tracksIdentities(document) ? (this.upserted.get(document.id) ?? this.committed.get(document.id))?.identities : undefined;
    return { ...metadataOf(document), ...(identities ? { snapshotIdentities: identities } : {}) };
  }

  private recoverableActiveId(id: string | null, documents: readonly RecoverySourceDocument[]): string | null {
    return documents.some(d => d.id === id) ? id : documents[0]?.id ?? null;
  }

  get hasPersistedSnapshot(): boolean {
    return this.persisted !== null;
  }

  forgetPersisted(): void {
    this.persisted = null;
    this.committed = new Map();
  }

  persistedIfcSource(documentId: string): RecoveryIfcSource | undefined {
    return this.persisted?.documents.find(d => d.id === documentId)?.ifcSource;
  }

  prepare(
    activeDocumentId: string | null,
    documents: readonly RecoverySourceDocument[],
    serialize: (source: IFCSaveSource, identities: boolean) => string | RecoverySnapshot,
  ): RecoverySaveInput | null {
    const delta = this.delta(activeDocumentId, documents);
    if (!delta.needsPersist) return null;
    this.upserted = new Map();
    const upserts: RecoveryDocContent[] = delta.changedDocuments.map((document) => {
      const tracked = tracksIdentities(document);
      const snapshot = this.cachedSnapshot(document) ?? snapshotOf(serialize(document.source, tracked), tracked);
      this.serialized.set(document.id, { ...snapshot, source: comparisonSource(document.source) });
      this.upserted.set(document.id, identitiesOf(snapshot));
      return { ...this.manifestDocument(document), ifc: snapshot.ifc };
    });
    const archives = archiveSuppliers(documents);
    return {
      activeDocumentId,
      documents: documents.map(document => this.manifestDocument(document)),
      upserts,
      ...(archives.size > 0 ? { archives } : {}),
      ifcSourceCopies: new Map(documents.flatMap(d => d.sourceCopy ? [[d.id, d.sourceCopy] as const] : [])),
    };
  }

  commit(activeDocumentId: string | null, documents: readonly RecoverySourceDocument[]): void {
    const retained = this.recoverableDocuments(documents);
    this.persisted = persistedRecoveryState(this.recoverableActiveId(activeDocumentId, retained), retained);
    const committed = new Map<string, SnapshotIdentities>();
    for (const { id } of retained) {
      const entry = this.upserted.get(id) ?? this.committed.get(id);
      if (entry) committed.set(id, entry);
    }
    this.committed = committed;
    this.upserted = new Map();
    const openIds = new Set(documents.map((document) => document.id));
    for (const id of this.serialized.keys()) if (!openIds.has(id)) this.serialized.delete(id);
  }
}
