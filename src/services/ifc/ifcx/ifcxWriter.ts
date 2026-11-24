import type { WriteIFCInput } from '../ifcWriter';
import { selfCheckDifferences } from './selfCheck';
import { IfcxWriteRefusedError } from './ifcxErrors';
import { readIfcxText } from './ifcxReader';
import { ownFileFor } from './ownFile';
import type { IfcxDocument } from './projection';

export type { IfcxDocument, IfcxEntry, IfcxHeader } from './projection';

function indented(json: string): string {
  return json.replace(/\n/g, '\n  ');
}

export function serializeIfcx(document: IfcxDocument): string {
  return [
    '{',
    `  "header": ${indented(JSON.stringify(document.header, null, 2))},`,
    `  "imports": [],`,
    `  "schemas": ${indented(JSON.stringify(document.schemas, null, 2))},`,
    '  "data": [',
    document.data.map(entry => `    ${JSON.stringify(entry)}`).join(',\n'),
    '  ]',
    '}',
    '',
  ].join('\n');
}

export function writeIfcx(given: WriteIFCInput, writtenAt: Date = new Date()): string {
  const { planning, document } = ownFileFor(given, writtenAt);
  const text = serializeIfcx(document);
  let reread;
  try {
    reread = readIfcxText(text, false);
  } catch (error) {
    throw new IfcxWriteRefusedError('self-check', `De IFCX-uitvoer leest niet terug: ${error instanceof Error ? error.message : String(error)}`);
  }
  const differences = selfCheckDifferences(planning, reread);
  if (differences.length > 0) {
    throw new IfcxWriteRefusedError('self-check', `De IFCX-uitvoer geeft een andere planning: ${differences.join('; ')}`,
      differences.map(difference => difference.slice(0, difference.indexOf(': '))));
  }
  return text;
}
