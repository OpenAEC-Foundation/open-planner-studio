import type { WriteIFCInput } from '../ifcWriter';
import type { ImportResult } from '@/services/importTypes';
import { checkValue } from './fieldTable';
import { identityProblems, type PlanningModel } from './identity';
import { HEADER_VALUE } from './ownAttributes';
import { attributeValueProblem } from './schemaCheck';
import { unsupportedContent } from './unsupportedContent';
import { stepRoundtrip } from './stepRoundtrip';
import { selfCheckDifferences } from './selfCheck';
import { IfcxWriteRefusedError } from './ifcxErrors';
import { PLANNING_NAMESPACE, type IfcxAttributeName } from './profile';
import { readIfcxText } from './ifcxReader';
import { composeIfcxDocument, globalIdsOf, type IfcxDocument } from './projection';

export type { IfcxDocument, IfcxEntry, IfcxHeader } from './projection';

function refused(code: 'unsupported' | 'inconsistent' | 'invalid', details: readonly string[], fields: readonly string[]): IfcxWriteRefusedError {
  return new IfcxWriteRefusedError(code, details.join('; '), [...new Set(fields)]);
}

const isSharedAttribute = (name: string) => name.startsWith(PLANNING_NAMESPACE);

function invalidValuesIn(document: IfcxDocument): IfcxWriteRefusedError | undefined {
  const header = checkValue(HEADER_VALUE, document.header);
  if (header) return refused('invalid', [`Ongeldige kop: ${header.kind === 'invalid' ? header.detail : 'onbekend veld'}`], [`header.${header.field}`]);
  for (const entry of document.data) {
    const attributes = Object.entries(entry.attributes) as [IfcxAttributeName, Record<string, unknown>][];
    for (const [name, value] of [...attributes.filter(([name]) => !isSharedAttribute(name)), ...attributes.filter(([name]) => isSharedAttribute(name))]) {
      const problem = attributeValueProblem(entry.path, name, value);
      if (problem) return refused('invalid', [`${name}: ${problem.detail}`], [`${name}.${problem.place.field ?? ''}`]);
    }
  }
  return undefined;
}

export function buildIfcxDocument(input: PlanningModel, writtenAt: Date): IfcxDocument {
  if (Number.isNaN(writtenAt.getTime())) throw refused('invalid', ['Het moment van schrijven is geen geldige datum'], ['header.timestamp']);
  let document: IfcxDocument;
  try {
    document = composeIfcxDocument(input, writtenAt, globalIdsOf(input));
  } catch (error) {
    if (error instanceof IfcxWriteRefusedError) throw error;
    throw refused('invalid', [`De planning heeft een vorm die de writer niet kan schrijven: ${messageOf(error)}`], ['planning']);
  }
  const invalid = invalidValuesIn(document);
  if (invalid) throw invalid;
  return document;
}

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

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function writeIfcx(given: WriteIFCInput, writtenAt: Date = new Date()): string {
  const identity = identityProblems(given, globalIdsOf(given));
  if (identity.length > 0) throw refused('inconsistent', identity.map(item => item.detail), identity.map(item => item.field));
  let planning: ImportResult;
  try {
    planning = stepRoundtrip(given);
  } catch (error) {
    throw refused('invalid', [`Opslaan als IFC weigert deze planning: ${messageOf(error)}`], ['planning']);
  }
  const unsupported = unsupportedContent(planning);
  if (unsupported.length > 0) {
    throw new IfcxWriteRefusedError('unsupported', `IFCX draagt deze gegevens nog niet: ${unsupported.join(', ')}`, unsupported);
  }
  const text = serializeIfcx(buildIfcxDocument(planning, writtenAt));
  let reread;
  try {
    reread = readIfcxText(text, false);
  } catch (error) {
    throw new IfcxWriteRefusedError('self-check', `De IFCX-uitvoer leest niet terug: ${messageOf(error)}`);
  }
  const differences = selfCheckDifferences(planning, reread);
  if (differences.length > 0) {
    throw new IfcxWriteRefusedError('self-check', `De IFCX-uitvoer geeft een andere planning: ${differences.join('; ')}`,
      differences.map(difference => difference.slice(0, difference.indexOf(': '))));
  }
  return text;
}
