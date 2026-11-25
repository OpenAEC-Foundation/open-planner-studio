import type { WriteIFCInput } from '../ifcWriter';
import { selfCheckDifferences } from './selfCheck';
import { IfcxWriteRefusedError } from './ifcxErrors';
import { readIfcx } from './ifcxReader';
import { canonicalFor, ownFileFor } from './ownFile';
import { serializeIfcx } from './projection';

export type { IfcxDocument, IfcxEntry, IfcxHeader } from './projection';

export function writeIfcx(given: WriteIFCInput, writtenAt: Date = new Date()): string {
  const canonical = canonicalFor(given);
  const { document } = ownFileFor(canonical, writtenAt);
  const text = serializeIfcx(document);
  let reread;
  try {
    reread = readIfcx(new TextEncoder().encode(text));
  } catch (error) {
    throw new IfcxWriteRefusedError('self-check', `De eigen lezer opent de IFCX-uitvoer niet: ${error instanceof Error ? error.message : String(error)}`);
  }
  const differences = selfCheckDifferences(canonical, reread);
  if (differences.length > 0) {
    throw new IfcxWriteRefusedError('self-check', `De IFCX-uitvoer geeft een andere planning: ${differences.join('; ')}`,
      differences.map(difference => difference.slice(0, difference.indexOf(': '))));
  }
  return text;
}
