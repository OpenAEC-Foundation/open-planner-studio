import { sameIFCSource, type IFCSaveSource } from '@/state/ifcSaveInput';
import type {
  RecoveryArchiveSupplier, RecoveryDocContent, RecoveryDocMetadata, RecoverySaveInput,
} from './recoveryStore';
import { decodeXerSourceArchive } from '@/services/xerSourceArchive';

/** Eén open document, precies zoals de auto-save het aan de recoverylaag aanbiedt. */
export interface RecoverySourceDocument extends RecoveryDocMetadata {
  source: IFCSaveSource;
}

/** De manifeststaat die na een geslaagde opslagronde werkelijk gepersisteerd is. */
export interface PersistedRecoveryState {
  activeDocumentId: string | null;
  documents: RecoveryDocMetadata[];
  sources: ReadonlyMap<string, IFCSaveSource>;
}

export interface RecoveryDelta {
  /** Alleen deze documenten moeten opnieuw met `writeIFC` worden geserialiseerd. */
  changedDocuments: RecoverySourceDocument[];
  /** Een actieve tab-, pad- of dirty-metadatawijziging vraagt alleen een manifestschrijf. */
  manifestChanged: boolean;
  /** Geen inhouds- én geen metadatawijziging betekent: helemaal geen I/O. */
  needsPersist: boolean;
}

/**
 * De manifestmetadata van één document. `xerArchive` volgt uit de bron zelf (de sha256 van het
 * bronarchief), zodat manifest en referentiesnapshot per constructie naar dezelfde blob wijzen.
 */
function metadataOf(document: RecoverySourceDocument): RecoveryDocMetadata {
  const { id, filePath, isDirty, datesAsRecorded } = document;
  const sha = document.source.xerSourceArchive?.sha256;
  return { id, filePath, isDirty, datesAsRecorded, ...(sha ? { xerArchive: sha } : {}) };
}

/**
 * Per verwezen archief een LAZY leverancier van de bronbytes. Een closure kost niets; de opslaglaag
 * roept hem alleen aan als de blob nog ontbreekt.
 */
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
      // De modusvlag hoort bij de manifestmetadata: een documentwissel in of
      // uit "datums zoals opgeslagen" moet ook zónder inhoudswijziging een manifestschrijf geven.
      && value.datesAsRecorded === other.datesAsRecorded
      && (value.xerArchive ?? null) === (other.xerArchive ?? null);
  });
}

/**
 * Bepaal de recoverydelta uitsluitend uit de IFC-bronvelden. `isDirty` zit in manifestmetadata
 * voor de herstelweergave, maar is uitdrukkelijk GEEN revisie-id: een ongewijzigd document kan
 * dirty blijven en een actieve-tabwissel heeft geen nieuwe IFC nodig.
 */
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
    || !sameMetadata(persisted.documents, metadata);
  return {
    changedDocuments,
    manifestChanged,
    needsPersist: manifestChanged || changedDocuments.length > 0,
  };
}

/** Maak pas na een geslaagde opslagronde een nieuwe persistentiebasis. */
export function persistedRecoveryState(
  activeDocumentId: string | null,
  documents: readonly RecoverySourceDocument[],
): PersistedRecoveryState {
  return {
    activeDocumentId,
    documents: documents.map(metadataOf),
    sources: new Map(documents.map((document) => [document.id, document.source])),
  };
}

/**
 * Stateful adapter voor de auto-save-hook. `prepare` mag IFC-teksten cachen, maar alleen
 * `commit` verschuift de persistentiebasis. De hook roept `commit` pas ná een geslaagde
 * `saveRecovery` aan; een quota-/storagefout laat de gewijzigde bron dus verplicht in de volgende
 * delta staan in plaats van hem stil als al opgeslagen te behandelen.
 */
export class RecoveryDeltaTracker {
  private persisted: PersistedRecoveryState | null = null;
  private readonly serialized = new Map<string, { source: IFCSaveSource; ifc: string }>();

  get hasPersistedSnapshot(): boolean {
    return this.persisted !== null;
  }

  prepare(
    activeDocumentId: string | null,
    documents: readonly RecoverySourceDocument[],
    serialize: (source: IFCSaveSource) => string,
  ): RecoverySaveInput | null {
    const delta = planRecoveryDelta(activeDocumentId, documents, this.persisted);
    if (!delta.needsPersist) return null;
    const upserts: RecoveryDocContent[] = delta.changedDocuments.map((document) => {
      const cached = this.serialized.get(document.id);
      const ifc = cached && sameIFCSource(cached.source, document.source)
        ? cached.ifc
        : serialize(document.source);
      this.serialized.set(document.id, { source: document.source, ifc });
      return { ...metadataOf(document), ifc };
    });
    const archives = archiveSuppliers(documents);
    return {
      activeDocumentId,
      documents: documents.map(metadataOf),
      upserts,
      ...(archives.size > 0 ? { archives } : {}),
    };
  }

  commit(activeDocumentId: string | null, documents: readonly RecoverySourceDocument[]): void {
    this.persisted = persistedRecoveryState(activeDocumentId, documents);
    const openIds = new Set(documents.map((document) => document.id));
    for (const id of this.serialized.keys()) if (!openIds.has(id)) this.serialized.delete(id);
  }
}
