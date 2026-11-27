import { hasKey, ifc5ValueDescription, membersOf, objectOf, TEXT, type IfcxMember } from './fieldTable';
import { DOCUMENT_FIELDS } from './fields/documentFields';
import { ATTRIBUTE } from './profile';
import type { IfcxDocument } from './projection';

const fields = DOCUMENT_FIELDS.flatMap<(IfcxMember & { key: string })>(field => field.key === 'ifcSchema'
  ? [field, { key: 'ifcSchemaUnconfirmed', value: TEXT, optional: true }]
  : [field]);

export const LEGACY_DOCUMENT_VALUE = objectOf(membersOf(fields));
export const LEGACY_DOCUMENT_SCHEMA = { value: ifc5ValueDescription(LEGACY_DOCUMENT_VALUE) };

export function legacyDocumentProjection(current: IfcxDocument, question: unknown): IfcxDocument {
  const schemas = { ...current.schemas, [ATTRIBUTE.document]: LEGACY_DOCUMENT_SCHEMA };
  if (question === undefined) return { ...current, schemas };
  const data = current.data.map(entry => {
    const doc = entry.attributes[ATTRIBUTE.document];
    if (!doc) return entry;
    const values: Record<string, unknown> = { ...doc, ifcSchemaUnconfirmed: question };
    const ordered = Object.fromEntries(fields.filter(f => hasKey(values, f.key)).map(f => [f.key, values[f.key]]));
    return { ...entry, attributes: { ...entry.attributes, [ATTRIBUTE.document]: ordered } };
  });
  return { ...current, schemas, data };
}
