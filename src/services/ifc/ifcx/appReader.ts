import { IfcxReadError } from './ifcxErrors';
import { classifyIfcxRead, readIfcx } from './ifcxReader';

export function readIfcxForApp(bytes: Uint8Array) {
  const read = readIfcx(bytes);
  const appCannotPreserveModelReferences = read.modelSource || read.elementLinks;
  if (appCannotPreserveModelReferences) throw new IfcxReadError('newer-profile', 'De app kan modelverwijzingen nog niet bewaren');
  return read;
}

export const classifyIfcxForApp = (bytes: Uint8Array) => classifyIfcxRead(() => readIfcxForApp(bytes));
