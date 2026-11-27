import { checkValue, hasKey } from './fieldTable';
import { isOwnAttributeName, OWN_ATTRIBUTE_VALUES, ownSchemas } from './nodes';
import type { IfcxErrorPlace, IfcxReadErrorCode } from './ifcxErrors';
import { ATTRIBUTE, OPS_NAMESPACE } from './profile';
import { LEGACY_DOCUMENT_SCHEMA, LEGACY_DOCUMENT_VALUE } from './legacyDocument';

export interface IfcxCheckProblem {
  readonly code: IfcxReadErrorCode;
  readonly detail: string;
  readonly place: IfcxErrorPlace;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => (isPlainObject(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item));
}

const ownNames = new Set(OWN_ATTRIBUTE_VALUES.keys());
const schemaDefinitions = {
  original: ownSchemas(ownNames, false),
  canadian: ownSchemas(ownNames, true),
};
const legacySchemaJson = canonicalJson(LEGACY_DOCUMENT_SCHEMA);

export function usesLegacyDocumentSchema(schemas: unknown): boolean {
  return isPlainObject(schemas) && canonicalJson(schemas[ATTRIBUTE.document]) === legacySchemaJson;
}

export function hasCanadianGeneration(value: unknown): boolean {
  return isPlainObject(value) && isPlainObject(value.generation) && value.generation.ruleSetId === 'CA';
}

function unknownAttribute(name: string, place: IfcxErrorPlace, what: string): IfcxCheckProblem {
  return name.startsWith(OPS_NAMESPACE)
    ? { code: 'newer-profile', detail: `${what} van een nieuwere Open Planner Studio`, place }
    : { code: 'foreign', detail: `${what} dat Open Planner Studio niet schrijft`, place };
}

export function schemaDefinitionProblems(
  schemas: unknown, used: ReadonlySet<string>, canadianGeneration: boolean, legacyDocument = false,
): IfcxCheckProblem[] {
  if (!isPlainObject(schemas)) return [{ code: 'invalid', detail: 'Het bestand heeft geen schemas', place: { field: 'schemas' } }];
  const expected = canadianGeneration ? schemaDefinitions.canadian : schemaDefinitions.original;
  const problems: IfcxCheckProblem[] = [];
  for (const name of Object.keys(schemas)) {
    const place = { attribute: name, field: 'schemas' };
    if (!isOwnAttributeName(name)) problems.push(unknownAttribute(name, place, 'Een schema'));
    else if (canonicalJson(schemas[name]) !== (legacyDocument && name === ATTRIBUTE.document
      ? legacySchemaJson : canonicalJson(expected[name]))) {
      problems.push({ code: 'invalid', detail: 'Het schema wijkt af van het profiel', place });
    }
  }
  for (const name of used) {
    if (!hasKey(schemas, name)) problems.push({ code: 'invalid', detail: 'Het schema ontbreekt', place: { attribute: name, field: 'schemas' } });
  }
  return problems;
}

export function attributeValueProblem(path: string, name: string, value: unknown, legacyDocument = false, paths?: ReadonlySet<string>): IfcxCheckProblem | undefined {
  if (!isOwnAttributeName(name)) return unknownAttribute(name, { path, attribute: name }, 'Een attribuut');
  const spec = legacyDocument && name === ATTRIBUTE.document ? LEGACY_DOCUMENT_VALUE : OWN_ATTRIBUTE_VALUES.get(name)!;
  const problem = checkValue(spec, value, paths);
  if (!problem) return undefined;
  const place = { path, attribute: name, field: problem.field };
  return problem.kind === 'invalid'
    ? { code: 'invalid', detail: `Ongeldige waarde: ${problem.detail}`, place }
    : unknownAttribute(name, place, 'Een veld');
}

export function ifcxSchemaProblems(document: unknown): string[] {
  if (!isPlainObject(document) || !Array.isArray(document.data)) return ['geen IFCX-document met data'];
  const used = new Set<string>();
  const paths = new Set<string>(document.data.flatMap(entry => isPlainObject(entry) && typeof entry.path === 'string' ? [entry.path] : []));
  const legacyDocument = usesLegacyDocumentSchema(document.schemas);
  const problems: IfcxCheckProblem[] = [];
  let canadianGeneration = false;
  for (const entry of document.data) {
    if (!isPlainObject(entry) || !isPlainObject(entry.attributes)) continue;
    for (const [name, value] of Object.entries(entry.attributes)) {
      used.add(name);
      if (name === ATTRIBUTE.opsCalendar && hasCanadianGeneration(value)) canadianGeneration = true;
      const problem = attributeValueProblem(String(entry.path), name, value, legacyDocument, paths);
      if (problem) problems.push(problem);
    }
  }
  problems.push(...schemaDefinitionProblems(document.schemas, used, canadianGeneration, legacyDocument));
  return problems.map(problem => `${[problem.place.path, problem.place.attribute, problem.place.field].filter(Boolean).join(' ')}: ${problem.detail}`);
}
