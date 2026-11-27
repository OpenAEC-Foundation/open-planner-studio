import type { WriteIFCInput } from '../ifcWriter';
import type { ImportResult } from '@/services/importTypes';
import { checkValue } from './fieldTable';
import { identityProblems, type PlanningModel } from './identity';
import { HEADER_VALUE } from './ownAttributes';
import { attributeValueProblem } from './schemaCheck';
import { IfcxWriteRefusedError, type IfcxErrorPlace } from './ifcxErrors';
import { PLANNING_NAMESPACE } from './profile';
import type { IfcxModelReferences } from './modelReferences';
import { composeIfcxDocument, globalIdsOf, objectLabels, type IfcxDocument } from './projection';

export type CanonicalPlanning = ImportResult & Pick<WriteIFCInput, 'minuteModelPending'>;

export interface OwnFile {
  readonly document: IfcxDocument;
  readonly assertAttributeValues: () => void;
}

function refused(details: readonly string[], fields: readonly string[], place?: IfcxErrorPlace): IfcxWriteRefusedError {
  return new IfcxWriteRefusedError('invalid', details.join('; '), [...new Set(fields)], place);
}

export function assertIdentity(planning: PlanningModel): void {
  const identity = identityProblems(planning, globalIdsOf(planning));
  if (identity.length > 0) {
    throw new IfcxWriteRefusedError('inconsistent', identity.map(item => item.detail).join('; '), [...new Set(identity.map(item => item.field))]);
  }
}

const isSharedAttribute = (name: string) => name.startsWith(PLANNING_NAMESPACE);

function invalidAttributesIn(document: IfcxDocument, objectAt: () => Map<string, string>): IfcxWriteRefusedError | undefined {
  for (const entry of document.data) {
    const attributes = Object.entries(entry.attributes);
    for (const [name, value] of [...attributes.filter(([name]) => !isSharedAttribute(name)), ...attributes.filter(([name]) => isSharedAttribute(name))]) {
      const problem = attributeValueProblem(entry.path, name, value);
      if (problem) {
        const object = objectAt().get(entry.path) ?? entry.path;
        return refused([`${object}: ${name}: ${problem.detail}`], [`${name}.${problem.place.field ?? ''}`], problem.place);
      }
    }
  }
  return undefined;
}

export function ownFileFor(planning: PlanningModel & IfcxModelReferences, writtenAt: Date, attributeValues: 'checked' | 'deferred' = 'checked'): OwnFile {
  if (Number.isNaN(writtenAt.getTime())) throw refused(['Het moment van schrijven is geen geldige datum'], ['header.timestamp']);
  assertIdentity(planning);
  const globalIdOf = globalIdsOf(planning);
  let document: IfcxDocument;
  try {
    document = composeIfcxDocument(planning, writtenAt, globalIdOf);
  } catch (error) {
    if (error instanceof IfcxWriteRefusedError) throw error;
    throw refused([`De planning heeft een vorm die de writer niet kan schrijven: ${error instanceof Error ? error.message : String(error)}`], ['planning']);
  }
  const header = checkValue(HEADER_VALUE, document.header);
  if (header) throw refused([`Ongeldige kop: ${header.kind === 'invalid' ? header.detail : 'onbekend veld'}`], [`header.${header.field}`]);
  let labels: Map<string, string> | undefined;
  const assertAttributeValues = () => {
    const invalid = invalidAttributesIn(document, () => (labels ??= objectLabels(planning, globalIdOf)));
    if (invalid) throw invalid;
  };
  if (attributeValues === 'checked') assertAttributeValues();
  return { document, assertAttributeValues };
}
