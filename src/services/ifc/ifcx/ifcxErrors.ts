export type IfcxReadErrorCode = 'not-ifcx' | 'version' | 'newer-profile' | 'foreign' | 'invalid';

export interface IfcxErrorPlace {
  readonly path?: string;
  readonly attribute?: string;
  readonly field?: string;
}

export class IfcxReadError extends Error {
  readonly code: IfcxReadErrorCode;
  readonly place: IfcxErrorPlace;

  constructor(code: IfcxReadErrorCode, detail: string, place: IfcxErrorPlace = {}) {
    const where = [place.path, place.attribute, place.field].filter(Boolean).join(' ');
    super(where ? `${detail} (${where})` : detail);
    this.name = 'IfcxReadError';
    this.code = code;
    this.place = place;
  }
}

export type IfcxWriteRefusedCode = 'unsupported' | 'self-check';

export class IfcxWriteRefusedError extends Error {
  readonly code: IfcxWriteRefusedCode;
  readonly fields: readonly string[];

  constructor(code: IfcxWriteRefusedCode, detail: string, fields: readonly string[] = []) {
    super(detail);
    this.name = 'IfcxWriteRefusedError';
    this.code = code;
    this.fields = fields;
  }
}
