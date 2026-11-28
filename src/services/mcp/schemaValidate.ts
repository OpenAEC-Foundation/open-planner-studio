export const SUPPORTED_KEYWORDS: readonly string[] = [
  'type',
  'enum',
  'required',
  'properties',
  'additionalProperties',
  'items',
  'minItems',
  'maxItems',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'pattern',
];

const DOC_KEYWORDS: readonly string[] = ['description', 'title', 'examples', 'default'];

export const ATOMIC_ITEM_TOOLS: ReadonlySet<string> = new Set(['planner_add_tasks', 'planner_set_task_splits']);

type Json = unknown;

function jsonType(v: Json): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  const t = typeof v;
  if (t === 'number') return Number.isInteger(v as number) ? 'integer' : 'number';
  return t;
}

function show(v: Json): string {
  if (v === undefined) return 'undefined';
  let s: string;
  try {
    s = JSON.stringify(v) ?? String(v);
  } catch {
    s = String(v);
  }
  return s.length > 60 ? `${s.slice(0, 57)}...` : s;
}

function gotLabel(v: Json): string {
  const t = jsonType(v);
  return `${t === 'integer' ? 'number' : t} ${show(v)}`;
}

function isPlainObject(v: Json): v is Record<string, Json> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function matchesType(v: Json, want: string): boolean {
  switch (want) {
    case 'null': return v === null;
    case 'array': return Array.isArray(v);
    case 'object': return isPlainObject(v);
    case 'string': return typeof v === 'string';
    case 'boolean': return typeof v === 'boolean';
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'integer': return typeof v === 'number' && Number.isInteger(v);
    default: return true;
  }
}

function joinPath(base: string, key: string): string {
  return base ? `${base}.${key}` : key;
}

function violation(path: string, message: string): string {
  return `${path || 'arguments'}: ${message}`;
}

function walk(schema: Json, value: Json, path: string, out: string[], deepArrayItems: boolean): void {
  if (!isPlainObject(schema)) return;

  const t = schema.type;
  if (typeof t === 'string' || Array.isArray(t)) {
    const wanted = (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === 'string');
    if (wanted.length > 0 && !wanted.some((w) => matchesType(value, w))) {
      out.push(violation(path, `expected ${wanted.join(' or ')}, got ${gotLabel(value)}`));
      return;
    }
  }

  if (Array.isArray(schema.enum)) {
    const allowed = schema.enum as Json[];
    const hit = allowed.some((a) => a === value || (typeof a === 'object' && JSON.stringify(a) === JSON.stringify(value)));
    if (!hit) {
      out.push(violation(path, `must be one of [${allowed.map((a) => show(a)).join(', ')}], got ${show(value)}`));
    }
  }

  if (typeof value === 'string' && typeof schema.pattern === 'string') {
    let re: RegExp | null = null;
    try { re = new RegExp(schema.pattern); } catch { re = null; }
    if (re && !re.test(value)) {
      out.push(violation(path, `does not match the expected pattern /${schema.pattern}/, got ${show(value)}`));
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      out.push(violation(path, `must be ≥ ${schema.minimum}, got ${value}`));
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      out.push(violation(path, `must be ≤ ${schema.maximum}, got ${value}`));
    }
    if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) {
      out.push(violation(path, `must be > ${schema.exclusiveMinimum}, got ${value}`));
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      out.push(violation(path, `expected at least ${schema.minItems} item(s), got ${value.length}`));
    }
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
      out.push(violation(path, `expected at most ${schema.maxItems} item(s), got ${value.length}`));
    }
    if (isPlainObject(schema.items)) {
      for (let i = 0; i < value.length; i++) {
        if (deepArrayItems) {
          walk(schema.items, value[i], `${path}[${i}]`, out, true);
        } else {
          walk({ type: (schema.items as Record<string, Json>).type }, value[i], `${path}[${i}]`, out, false);
        }
      }
    }
  }

  if (isPlainObject(value)) {
    const props = isPlainObject(schema.properties) ? schema.properties : undefined;
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (typeof key !== 'string') continue;
        if (!(key in value) || value[key] === undefined) {
          out.push(violation(path, `required field \`${key}\` is missing`));
        }
      }
    }
    if (schema.additionalProperties === false && props) {
      const allowed = Object.keys(props);
      for (const key of Object.keys(value)) {
        if (!allowed.includes(key)) {
          out.push(violation(path, `unknown field \`${key}\`; allowed: ${allowed.join(', ')}`));
        }
      }
    }
    if (props) {
      for (const [key, sub] of Object.entries(props)) {
        if (!(key in value) || value[key] === undefined) continue;
        walk(sub, value[key], joinPath(path, key), out, deepArrayItems);
      }
    }
    if (isPlainObject(schema.additionalProperties)) {
      const extra = schema.additionalProperties;
      for (const key of Object.keys(value)) {
        if ((props && Object.prototype.hasOwnProperty.call(props, key)) || value[key] === undefined) continue;
        walk(extra, value[key], joinPath(path, key), out, deepArrayItems);
      }
    }
  }
}

export function validateToolArgs(
  schema: unknown,
  args: unknown,
  opts: { deepArrayItems?: boolean } = {},
): string | null {
  const value = args === undefined || args === null ? {} : args;
  const out: string[] = [];
  walk(schema, value, '', out, opts.deepArrayItems === true);
  if (out.length === 0) return null;
  const shown = out.slice(0, 8);
  const rest = out.length - shown.length;
  return shown.join('; ') + (rest > 0 ? ` (+${rest} more violation(s))` : '');
}

export function unsupportedKeywords(schema: unknown): string[] {
  const found = new Set<string>();
  const visit = (s: Json): void => {
    if (!isPlainObject(s)) return;
    for (const k of Object.keys(s)) {
      if (!SUPPORTED_KEYWORDS.includes(k) && !DOC_KEYWORDS.includes(k)) found.add(k);
    }
    if (isPlainObject(s.properties)) for (const v of Object.values(s.properties)) visit(v);
    if (isPlainObject(s.additionalProperties)) visit(s.additionalProperties);
    if (isPlainObject(s.items)) visit(s.items);
  };
  visit(schema);
  return [...found].sort();
}
