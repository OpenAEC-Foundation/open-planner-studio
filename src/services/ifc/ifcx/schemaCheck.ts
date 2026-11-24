import { checkValue, hasKey } from './fieldTable';
import { isOwnAttributeName, OWN_ATTRIBUTE_VALUES, ownSchemas } from './ownAttributes';
import type { IfcxErrorPlace, IfcxReadErrorCode } from './ifcxErrors';
import { OPS_NAMESPACE } from './profile';

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

const OWN_SCHEMA_DEFINITIONS = ownSchemas(new Set(OWN_ATTRIBUTE_VALUES.keys()));

function unknownAttribute(name: string, place: IfcxErrorPlace, what: string): IfcxCheckProblem {
  return name.startsWith(OPS_NAMESPACE)
    ? { code: 'newer-profile', detail: `${what} van een nieuwere Open Planner Studio`, place }
    : { code: 'foreign', detail: `${what} dat Open Planner Studio niet schrijft`, place };
}

export function schemaDefinitionProblems(schemas: unknown, used: ReadonlySet<string>): IfcxCheckProblem[] {
  if (!isPlainObject(schemas)) return [{ code: 'invalid', detail: 'Het bestand heeft geen schemas', place: { field: 'schemas' } }];
  const problems: IfcxCheckProblem[] = [];
  for (const name of Object.keys(schemas)) {
    const place = { attribute: name, field: 'schemas' };
    if (!isOwnAttributeName(name)) problems.push(unknownAttribute(name, place, 'Een schema'));
    else if (canonicalJson(schemas[name]) !== canonicalJson(OWN_SCHEMA_DEFINITIONS[name])) {
      problems.push({ code: 'invalid', detail: 'Het schema wijkt af van het profiel', place });
    }
  }
  for (const name of used) {
    if (!hasKey(schemas, name)) problems.push({ code: 'invalid', detail: 'Het schema ontbreekt', place: { attribute: name, field: 'schemas' } });
  }
  return problems;
}

export function attributeValueProblem(path: string, name: string, value: unknown): IfcxCheckProblem | undefined {
  if (!isOwnAttributeName(name)) return unknownAttribute(name, { path, attribute: name }, 'Een attribuut');
  const problem = checkValue(OWN_ATTRIBUTE_VALUES.get(name)!, value);
  if (!problem) return undefined;
  const place = { path, attribute: name, field: problem.field };
  return problem.kind === 'invalid'
    ? { code: 'invalid', detail: `Ongeldige waarde: ${problem.detail}`, place }
    : unknownAttribute(name, place, 'Een veld');
}

export function ifcxSchemaProblems(document: unknown): string[] {
  if (!isPlainObject(document) || !Array.isArray(document.data)) return ['geen IFCX-document met data'];
  const used = new Set<string>();
  const problems: IfcxCheckProblem[] = [];
  for (const entry of document.data) {
    if (!isPlainObject(entry) || !isPlainObject(entry.attributes)) continue;
    for (const [name, value] of Object.entries(entry.attributes)) {
      used.add(name);
      const problem = attributeValueProblem(String(entry.path), name, value);
      if (problem) problems.push(problem);
    }
  }
  problems.push(...schemaDefinitionProblems(document.schemas, used));
  return problems.map(problem => `${[problem.place.path, problem.place.attribute, problem.place.field].filter(Boolean).join(' ')}: ${problem.detail}`);
}
