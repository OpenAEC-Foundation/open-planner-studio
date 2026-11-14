import type { RecoverySourceCopy } from './recoverySourceCopies';
import { ifcSourceMetaFields, sameRecoveryIfcSource } from './recoveryIfcSource';
import { IfcCalendarTimePrecisionError } from '@/services/ifc/ifcErrors';
import { sameIFCSource, type IFCSaveSource } from '@/state/ifcSaveInput';
import { foreignSourceTargetOf } from '@/services/ifc/foreign/foreignSourceMark';
import {
  foreignSourceMetaFields, sameRecoveryForeignSource, sameRecoverySiteMeta, siteMetaFields,
  type RecoveryArchiveSupplier, type RecoveryDocContent, type RecoveryDocMetadata, type RecoverySaveInput,
} from './recoveryStore';
import { decodeXerSourceArchive } from '@/services/xerSourceArchive';

/** Eén open document, precies zoals de auto-save het aan de recoverylaag aanbiedt. */
export interface RecoverySourceDocument extends RecoveryDocMetadata {
  source: IFCSaveSource;
  sourceCopy?: RecoverySourceCopy;
}

/** De manifeststaat die na een geslaagde opslagronde werkelijk gepersisteerd is. */
export interface PersistedRecoveryState {
  activeDocumentId: string | null;
  documents: RecoveryDocMetadata[];
  sources: ReadonlyMap<string, IFCSaveSource>;
  /** De sitebasis bij de kopie; geen bronbytes in deze vergelijkingscache. */
  copyVersions?: ReadonlyMap<string, string | null>;
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
 * Het site-doel staat er alleen in als er een is: zonder site heeft de metadata exact dezelfde
 * velden als vóór issue #309.
 */
function metadataOf(document: RecoverySourceDocument): RecoveryDocMetadata {
  const { id, filePath, isDirty, datesAsRecorded } = document;
  const sha = document.source.xerSourceArchive?.sha256;
  return {
    id, filePath, isDirty, datesAsRecorded,
    ...(sha ? { xerArchive: sha } : {}),
    ...siteMetaFields(document),
    // #804 fase 1a, fixronde 1: het doel van een bron met een vreemd deel volgt uit de bron zelf, net als `xerArchive`,
    // zodat manifest en snapshot (de vingerafdruk) per constructie bij elkaar horen. Zonder kenmerk: weggelaten.
    ...foreignSourceMetaFields({ foreignSource: document.foreignSource !== undefined ? document.foreignSource : foreignSourceTargetOf(document.source.foreignSourceMark) }),
    ...ifcSourceMetaFields(document),
  };
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
      && (value.xerArchive ?? null) === (other.xerArchive ?? null)
      // Het site-doel en zijn basisversie zijn ook manifestmetadata: een opslag op de site (nieuwe
      // versie) of een nieuw doel geeft zonder inhoudswijziging een manifest-only schrijfactie.
      && sameRecoverySiteMeta(value, other)
      && sameRecoveryForeignSource(value, other)
      && sameRecoveryIfcSource(value, other);
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
    || !sameMetadata(persisted.documents, metadata)
    || documents.some(d => d.sourceCopy && d.sourceCopy.siteFileVersion !== persisted.copyVersions?.get(d.id));
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
    sources: new Map(documents.map((document) => [document.id, comparisonSource(document.source)])),
    copyVersions: new Map(documents.flatMap(d => d.sourceCopy ? [[d.id, d.sourceCopy.siteFileVersion] as const] : [])),
  };
}

/** De vergelijkingscache heeft de bronbytes niet nodig (IFC_DIRTY_KEYS). */
function comparisonSource(source: IFCSaveSource): IFCSaveSource {
  return source.ifcSource ? { ...source, ifcSource: null } : source;
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
  private readonly skipped = new Set<string>();
  private tail: Promise<unknown> = Promise.resolve();

  /** Houd delta, serialisatie, manifestcommit en persistentiebasis in dezelfde schrijfvolgorde. */
  runExclusive<T>(action: () => Promise<T>): Promise<T> {
    const run = this.tail.then(action, action);
    this.tail = run.catch(() => undefined);
    return run;
  }

  async prepareAsync(
    activeDocumentId: string | null,
    documents: readonly RecoverySourceDocument[],
    serialize: (source: IFCSaveSource) => Promise<string>,
  ): Promise<RecoverySaveInput | null> {
    const delta = planRecoveryDelta(activeDocumentId, documents, this.persisted);
    if (!delta.needsPersist) return null;
    this.skipped.clear();
    // Eén worker houdt het geheugengebruik begrensd; andere documenten wachten op hun beurt.
    for (const document of delta.changedDocuments) {
      const cached = this.serialized.get(document.id);
      if (!cached || !sameIFCSource(cached.source, document.source)) {
        try {
          const ifc = await serialize(document.source);
          this.serialized.set(document.id, { source: comparisonSource(document.source), ifc });
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

  /** Gebruik voor een geweigerd document exact de laatst gepersisteerde bron
   * én metadata. Een nieuw geweigerd document heeft nog geen herstelkopie. */
  private recoverableDocuments(documents: readonly RecoverySourceDocument[]): RecoverySourceDocument[] {
    return documents.flatMap(document => {
      if (!this.skipped.has(document.id)) return [document];
      const previous = this.persisted?.documents.find(d => d.id === document.id);
      const source = this.persisted?.sources.get(document.id);
      return previous && source ? [{ ...previous, source }] : [];
    });
  }

  private recoverableActiveId(id: string | null, documents: readonly RecoverySourceDocument[]): string | null {
    return documents.some(d => d.id === id) ? id : documents[0]?.id ?? null;
  }

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
      this.serialized.set(document.id, { source: comparisonSource(document.source), ifc });
      return { ...metadataOf(document), ifc };
    });
    const archives = archiveSuppliers(documents);
    return {
      activeDocumentId,
      documents: documents.map(metadataOf),
      upserts,
      ...(archives.size > 0 ? { archives } : {}),
      ifcSourceCopies: new Map(documents.flatMap(d => d.sourceCopy ? [[d.id, d.sourceCopy] as const] : [])),
    };
  }

  commit(activeDocumentId: string | null, documents: readonly RecoverySourceDocument[]): void {
    const retained = this.recoverableDocuments(documents);
    this.persisted = persistedRecoveryState(this.recoverableActiveId(activeDocumentId, retained), retained);
    const openIds = new Set(documents.map((document) => document.id));
    for (const id of this.serialized.keys()) if (!openIds.has(id)) this.serialized.delete(id);
  }
}
