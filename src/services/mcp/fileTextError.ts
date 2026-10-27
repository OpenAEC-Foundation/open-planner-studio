/** Een leesbaar bestand met ongeldige tekstbytes is VALIDATION, niet NOT_FOUND. */
export class FileTextDecodingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileTextDecodingError';
  }
}
