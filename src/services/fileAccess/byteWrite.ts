/** Fouten van de strikte byte-ingang; de aanroeper verzorgt de vertaalde melding. */
export class ByteWriteError extends Error {
  readonly code = 'BYTE_WRITE_FAILED';
  constructor(
    readonly reason: 'create-new' | 'write' | 'close' | 'handle-not-exclusive' | 'base-version' | 'download' | 'source-changed',
    readonly cause?: unknown,
  ) {
    super(`Bytes konden niet worden opgeslagen (${reason}).`);
    this.name = 'ByteWriteError';
  }
}

/** Blob neemt de buffer rechtstreeks aan: geen tekstomzetting of extra kopie. */
export function bytesBlob(bytes: Uint8Array, mime: string): Blob {
  return new Blob([bytes as BlobPart], { type: mime });
}
