export type IfcxReadErrorCode = 'not-ifcx' | 'version' | 'newer-profile' | 'foreign' | 'invalid' | 'no-planning';

export interface IfcxErrorPlace {
  readonly path?: string;
  readonly attribute?: string;
  readonly field?: string;
  readonly offset?: number;
}

export class IfcxReadError extends Error {
  readonly code: IfcxReadErrorCode;
  readonly place: IfcxErrorPlace;

  constructor(code: IfcxReadErrorCode, detail: string, place: IfcxErrorPlace = {}) {
    const where = [place.path, place.attribute, place.field, place.offset === undefined ? undefined : `teken ${place.offset}`].filter(Boolean).join(' ');
    super(where ? `${detail} (${where})` : detail);
    this.name = 'IfcxReadError';
    this.code = code;
    this.place = place;
  }
}

export type IfcxWriteRefusedCode = 'unsupported' | 'inconsistent' | 'invalid' | 'self-check';

export class IfcxWriteRefusedError extends Error {
  readonly code: IfcxWriteRefusedCode;
  readonly fields: readonly string[];
  readonly place: IfcxErrorPlace;

  constructor(code: IfcxWriteRefusedCode, detail: string, fields: readonly string[] = [], place: IfcxErrorPlace = {}) {
    super(detail);
    this.name = 'IfcxWriteRefusedError';
    this.code = code;
    this.fields = fields;
    this.place = place;
  }
}
