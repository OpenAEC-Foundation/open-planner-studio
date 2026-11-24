import { isOwnAttributeName, ownSchemas } from './ownAttributes';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function problemIn(description: unknown, value: unknown, at: string): string | undefined {
  if (!isPlainObject(description) || typeof description.dataType !== 'string') return `${at}: geen geldige schemabeschrijving`;
  const expected = (what: string) => `${at}: verwacht ${what}, gevonden ${JSON.stringify(value)}`;
  switch (description.dataType) {
    case 'String':
    case 'DateTime':
    case 'Reference':
      return typeof value === 'string' ? undefined : expected('tekst');
    case 'Boolean':
      return typeof value === 'boolean' ? undefined : expected('waar of onwaar');
    case 'Real':
      return typeof value === 'number' && Number.isFinite(value) ? undefined : expected('een getal');
    case 'Integer':
      return typeof value === 'number' && Number.isSafeInteger(value) ? undefined : expected('een geheel getal');
    case 'Enum': {
      const options = isPlainObject(description.enumRestrictions) ? description.enumRestrictions.options : undefined;
      if (!Array.isArray(options)) return `${at}: Enum zonder opties`;
      return typeof value === 'string' && options.includes(value) ? undefined : expected(`een van ${options.join(', ')}`);
    }
    case 'Array': {
      if (!Array.isArray(value)) return expected('een lijst');
      const item = isPlainObject(description.arrayRestrictions) ? description.arrayRestrictions.value : undefined;
      if (item === undefined) return `${at}: Array zonder arrayRestrictions`;
      for (let i = 0; i < value.length; i++) {
        const problem = problemIn(item, value[i], `${at}[${i}]`);
        if (problem) return problem;
      }
      return;
    }
    case 'Object': {
      if (!isPlainObject(value)) return expected('een object');
      const values = isPlainObject(description.objectRestrictions) ? description.objectRestrictions.values : undefined;
      if (!isPlainObject(values)) return `${at}: Object zonder objectRestrictions`;
      for (const key of Object.keys(value)) if (!Object.hasOwn(values, key)) return `${at}.${key}: veld staat niet in het schema`;
      for (const [key, member] of Object.entries(values)) {
        if (!Object.hasOwn(value, key)) {
          if (isPlainObject(member) && member.optional === true) continue;
          return `${at}.${key}: verplicht veld ontbreekt`;
        }
        const problem = problemIn(member, value[key], `${at}.${key}`);
        if (problem) return problem;
      }
      return;
    }
    default:
      return `${at}: onbekend dataType ${description.dataType}`;
  }
}

export function ifcxSchemaProblems(document: unknown): string[] {
  const problems: string[] = [];
  if (!isPlainObject(document) || !isPlainObject(document.schemas) || !Array.isArray(document.data)) return ['geen IFCX-document met schemas en data'];
  const schemas = document.schemas;
  const used = new Set<string>();
  for (const entry of document.data) {
    if (!isPlainObject(entry) || !isPlainObject(entry.attributes)) continue;
    for (const [name, value] of Object.entries(entry.attributes)) {
      used.add(name);
      const schema = schemas[name];
      if (!isPlainObject(schema)) {
        problems.push(`${String(entry.path)} ${name}: geen schema`);
        continue;
      }
      const problem = problemIn(schema.value, value, `${String(entry.path)} ${name}`);
      if (problem) problems.push(problem);
    }
  }
  const expected = ownSchemas(used);
  for (const name of Object.keys(schemas)) {
    if (!isOwnAttributeName(name)) continue;
    if (JSON.stringify(schemas[name]) !== JSON.stringify(expected[name])) problems.push(`${name}: schema wijkt af van het profiel`);
  }
  for (const name of Object.keys(expected)) if (!(name in schemas)) problems.push(`${name}: schema ontbreekt`);
  return problems;
}
