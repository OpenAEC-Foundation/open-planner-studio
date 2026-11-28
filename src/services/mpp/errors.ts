// Bron: MPXJ van Jon Iles e.a., structuurkennis en veldconstanten geport naar TypeScript (LGPL-2.1, github.com/joniles/mpxj).

export class MppUnsupportedError extends Error {
  readonly mppCode: 'MPP_LEGACY' | 'MPP_ENCRYPTED';

  constructor(code: 'MPP_LEGACY' | 'MPP_ENCRYPTED', detail: string) {
    super(`${detail} Open the file in MS Project and export it as XML (File > Save As > XML), then open that file.`);
    this.name = 'MppUnsupportedError';
    this.mppCode = code;
  }
}
