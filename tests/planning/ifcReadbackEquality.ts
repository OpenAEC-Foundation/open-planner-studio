import { isDeepStrictEqual, inspect } from 'node:util';
import type { WriteIFCInput } from '@/services/ifc/ifcWriter';

function readbackValue(input: WriteIFCInput): unknown {
  const { ifcSource: _source, writeMode: _mode, ...planning } = input as WriteIFCInput & { ifcSource?: unknown; writeMode?: unknown };
  const value = {
    ...planning,
    assignments: planning.assignments.map(({ id: _id, ...assignment }) => assignment),
    resourceCalendars: [...(planning.resourceCalendars ?? [])].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  };
  const optional = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(optional);
    if (item !== null && typeof item === 'object' && Object.getPrototypeOf(item) === Object.prototype) {
      return Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined).map(([k, v]) => [k, optional(v)]));
    }
    return item;
  };
  return optional(value);
}

export function readbackDifference(a: WriteIFCInput, b: WriteIFCInput): string | undefined {
  function first(x: unknown, y: unknown, path: string): string | undefined {
    if (isDeepStrictEqual(x, y)) return;
    if (x !== null && y !== null && typeof x === 'object' && typeof y === 'object'
      && (Array.isArray(x) && Array.isArray(y) || Object.getPrototypeOf(x) === Object.prototype && Object.getPrototypeOf(y) === Object.prototype)) {
      const left = x as Record<string, unknown>, right = y as Record<string, unknown>;
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
        const problem = first(left[key], right[key], `${path}.${key}`);
        if (problem) return problem;
      }
    }
    const show = (v: unknown) => inspect(v, { depth: 1, maxArrayLength: 4, breakLength: Infinity });
    return `${path}: ${show(x)} → ${show(y)}`;
  }
  return first(readbackValue(a), readbackValue(b), 'planning');
}
