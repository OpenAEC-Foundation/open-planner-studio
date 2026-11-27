import { isRecord } from '@/utils/guards';
import { IfcxReadError } from './ifcxErrors';
import { IFCX_VERSION } from './profile';

export function sameOwnIfcxContent(left: string, right: string): boolean {
  const writeTime = /\n    "timestamp": "[^"\n]+"(?=\n  },\n  "imports":)/;
  return left === right || left.replace(writeTime, '') === right.replace(writeTime, '');
}

export function decodeIfcx(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new IfcxReadError('not-ifcx', 'Het bestand is geen UTF-8-tekst');
  }
}

export function parseIfcx(text: string) {
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    throw new IfcxReadError('not-ifcx', 'Het bestand is geen JSON');
  }
  if (!isRecord(document) || !isRecord(document.header) || typeof document.header.ifcxVersion !== 'string'
    || !Array.isArray(document.data)) {
    throw new IfcxReadError('not-ifcx', 'Het bestand heeft geen IFCX-kop en -data');
  }
  if (document.header.ifcxVersion !== IFCX_VERSION) {
    throw new IfcxReadError('version', `Onbekende IFCX-versie ${JSON.stringify(document.header.ifcxVersion)}`);
  }
  return document as Record<string, unknown> & { header: Record<string, unknown>; data: unknown[] };
}
