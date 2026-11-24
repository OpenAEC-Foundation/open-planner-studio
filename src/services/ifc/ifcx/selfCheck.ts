import type { ImportResult } from '@/services/importTypes';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Set) && !(value instanceof Map);
}

function comparable(value: unknown): unknown {
  if (value instanceof Set) return [...value];
  if (value instanceof Map) return [...value];
  return value;
}

function describe(value: unknown): string {
  const text = value === undefined ? 'afwezig' : JSON.stringify(comparable(value)) ?? String(value);
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

function differencesIn(left: unknown, right: unknown, path: string, out: string[], limit: number): void {
  if (out.length >= limit) return;
  const a = comparable(left), b = comparable(right);
  if (a === undefined && b === undefined) return;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) { out.push(`${path}: ${a.length} → ${b.length} items`); return; }
    for (let i = 0; i < a.length && out.length < limit; i++) differencesIn(a[i], b[i], `${path}[${i}]`, out, limit);
    return;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      differencesIn(a[key], b[key], path ? `${path}.${key}` : key, out, limit);
      if (out.length >= limit) return;
    }
    return;
  }
  if (!Object.is(a, b) && !(a === 0 && b === 0)) out.push(`${path}: ${describe(a)} → ${describe(b)}`);
}

export function selfCheckDifferences(planning: ImportResult, reread: ImportResult, limit = 5): string[] {
  const out: string[] = [];
  differencesIn(planning, reread, '', out, limit);
  return out;
}
