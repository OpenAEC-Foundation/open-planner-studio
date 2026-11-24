import type { FileRef } from '@/services/fileAccess';
import type { OpenedImport } from '@/services/importTypes';
import type { OpenLookup } from './openDocumentFor';

export interface NewVersionBasis {
  readonly ref: FileRef;
  readonly known: string | null;
}

export interface DocumentLeaveGate {
  blocked(): boolean;
  leave(proceed: () => void): void;
}

export class PreparedNewVersion {
  constructor(
    readonly documentId: string,
    readonly basis: NewVersionBasis,
    readonly name: string,
    readonly content: string,
    readonly parsed: OpenedImport,
    readonly siteFileVersion: string | null,
    readonly lookup: OpenLookup | null,
  ) {}
}
