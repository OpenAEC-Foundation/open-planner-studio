// Alleen de twee lezingen van DEZELFDE uitvoer vergelijken: geen writer en geen getalafronding.
import { isDeepStrictEqual, inspect } from 'node:util';
import type { WriteIFCInput } from '@/services/ifc/ifcWriter';

function readbackValue(input: WriteIFCInput): unknown {
  // ifcSource is documentcontext met bronbytes; de writer slaat dit niet als planningveld op.
  const { ifcSource: _source, ...planning } = input as WriteIFCInput & { ifcSource?: unknown };
  const value = {
    ...planning,
    // Toewijzings-ids worden nooit opgeslagen en door extractAssignments bij elke lezing nieuw gemaakt.
    // De lijsten en alle overige velden blijven staan: geen verloren/getransformeerde waarde kan hierin verdwijnen.
    assignments: planning.assignments.map(({ id: _id, ...assignment }) => assignment),
    // Alleen deze lijst heeft volgens Trias geen betekenisvolle volgorde; dubbele ids blijven aparte elementen.
    resourceCalendars: [...(planning.resourceCalendars ?? [])].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  };
  const optional = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(optional);
    if (item !== null && typeof item === 'object' && Object.getPrototypeOf(item) === Object.prototype) {
      // Een afwezig optioneel veld en een eigen property met undefined hebben dezelfde domeinbetekenis.
      return Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined).map(([k, v]) => [k, optional(v)]));
    }
    return item;
  };
  return optional(value);
}

/** Eerste rechtstreeks verschil, inclusief de precieze getallen; undefined betekent diep gelijk. */
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
