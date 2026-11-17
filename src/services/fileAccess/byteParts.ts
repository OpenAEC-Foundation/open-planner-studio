/** Fouten van de strikte byte-ingang; de aanroeper verzorgt de vertaalde melding. */
export class BytePartsWriteError extends Error {
  readonly code = 'BYTE_PARTS_WRITE_FAILED';
  constructor(
    readonly reason: 'create-new' | 'write' | 'close' | 'handle-not-exclusive' | 'base-version' | 'download',
    readonly cause?: unknown,
  ) {
    super(`Byte-delen konden niet worden opgeslagen (${reason}).`);
    this.name = 'BytePartsWriteError';
  }
}

/** Blob neemt de delen rechtstreeks aan: geen tekstomzetting of gezamenlijke werkbuffer. */
export function bytePartsBlob(parts: readonly Uint8Array[], mime: string): Blob {
  return new Blob(parts.map(part => part as BlobPart), { type: mime });
}
